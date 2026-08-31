const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Ahmed@2026#Store!92";

const ROOT = __dirname;
const DATA = path.join(ROOT, "data.json");
const UP = path.join(ROOT, "uploads");

if (!fs.existsSync(UP)) {
  fs.mkdirSync(UP, { recursive: true });
}

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(
    DATA,
    JSON.stringify({ apps: [] }, null, 2)
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, "public")));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UP),

  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    cb(null, Date.now() + "-" + safeName);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 200 * 1024 * 1024
  },

  fileFilter: (_, file, cb) => {
    cb(null, true);
  }
});

function db() {
  return JSON.parse(
    fs.readFileSync(DATA, "utf8")
  );
}

function save(data) {
  fs.writeFileSync(
    DATA,
    JSON.stringify(data, null, 2)
  );
}

function admin(req, res, next) {
  if (
    req.headers.authorization !==
    `Bearer ${ADMIN_PASSWORD}`
  ) {
    return res.status(401).json({
      error: "غير مصرح"
    });
  }

  next();
}


// =========================
// Get all apps
// =========================

app.get("/api/apps", (req, res) => {
  res.json(
    db().apps.filter(
      app => app.published !== false
    )
  );
});


// =========================
// Get one app
// =========================

app.get("/api/apps/:id", (req, res) => {
  const appData = db().apps.find(
    x => x.id === req.params.id
  );

  if (!appData) {
    return res.sendStatus(404);
  }

  res.json(appData);
});


// =========================
// Download APK
// =========================
// مهم: GET وليس POST

app.get("/api/apps/:id/download", (req, res) => {
  const data = db();

  const appData = data.apps.find(
    x => x.id === req.params.id
  );

  if (!appData) {
    return res.status(404).json({
      error: "التطبيق غير موجود"
    });
  }

  const filePath = path.join(
    UP,
    appData.file
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "ملف APK غير موجود"
    });
  }

  appData.downloads =
    (appData.downloads || 0) + 1;

  save(data);

  res.download(
    filePath,
    appData.original || appData.file
  );
});


// =========================
// Admin: Upload app
// =========================

app.post(
  "/api/admin/apps",
  admin,
  upload.single("apk"),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        error: "ملف APK مطلوب"
      });
    }

    const data = db();

    const appData = {
      id: Date.now().toString(),

      name: req.body.name,

      description:
        req.body.description || "",

      version:
        req.body.version || "1.0.0",

      category:
        req.body.category || "أخرى",

      icon:
        req.body.icon || "📱",

      file:
        req.file.filename,

      original:
        req.file.originalname,

      size:
        req.file.size,

      downloads: 0,

      published: true,

      createdAt:
        new Date().toISOString()
    };

    data.apps.unshift(appData);

    save(data);

    res.json(appData);
  }
);


// =========================
// Admin: Get apps
// =========================

app.get(
  "/api/admin/apps",
  admin,
  (req, res) => {
    res.json(db().apps);
  }
);


// =========================
// Admin: Delete app
// =========================

app.delete(
  "/api/admin/apps/:id",
  admin,
  (req, res) => {

    const data = db();

    const index =
      data.apps.findIndex(
        a => a.id === req.params.id
      );

    if (index < 0) {
      return res.sendStatus(404);
    }

    try {
      fs.unlinkSync(
        path.join(
          UP,
          data.apps[index].file
        )
      );
    } catch {}

    data.apps.splice(index, 1);

    save(data);

    res.sendStatus(204);
  }
);


// =========================
// Start server
// =========================

app.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});