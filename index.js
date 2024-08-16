const express = require("express");
const session = require("express-session");
const hbs = require("hbs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const app = express();
const prisma = new PrismaClient();

// Konfigurasi view engine
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "rahasia",
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware untuk memeriksa autentikasi
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
};

// Rute-rute
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.userId = user.id;
    res.redirect("/dashboard");
  } else {
    res.render("login", { error: "Email atau password salah" });
  }
});

app.get("/dashboard", requireAuth, async (req, res) => {
  const provinsis = await prisma.provinsi.findMany({
    where: { userId: req.session.userId },
  });
  res.render("dashboard", { provinsis });
});

// Rute untuk provinsi
app.get("/provinsi", requireAuth, async (req, res) => {
  const provinsis = await prisma.provinsi.findMany({
    where: { userId: req.session.userId },
  });
  res.render("provinsi", { provinsis });
});

app.get("/provinsi/tambah", requireAuth, (req, res) => {
  res.render("provinsi-form");
});

app.post("/provinsi/tambah", requireAuth, async (req, res) => {
  const { nama, diresmikan, photo, pulau } = req.body;
  await prisma.provinsi.create({
    data: {
      userId: req.session.userId,
      nama,
      diresmikan: new Date(diresmikan),
      photo,
      pulau,
    },
  });
  res.redirect("/provinsi");
});

app.get("/provinsi/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const provinsi = await prisma.provinsi.findUnique({ where: { id } });
  res.render("provinsi-form", { provinsi });
});

app.post("/provinsi/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { nama, diresmikan, photo, pulau } = req.body;
  await prisma.provinsi.update({
    where: { id },
    data: {
      nama,
      diresmikan: new Date(diresmikan),
      photo,
      pulau,
    },
  });
  res.redirect("/provinsi");
});

app.get("/provinsi/:id/hapus", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.provinsi.delete({ where: { id } });
  res.redirect("/provinsi");
});

// Rute untuk kabupaten
app.get("/kabupaten", requireAuth, async (req, res) => {
  const kabupatens = await prisma.kabupaten.findMany({
    include: { provinsi: true },
  });
  res.render("kabupaten", { kabupatens });
});

app.get("/kabupaten/tambah", requireAuth, async (req, res) => {
  try {
    const provinsis = await prisma.provinsi.findMany({
      select: { id: true, nama: true },
    });
    res.render("kabupaten-form", { provinsis });
  } catch (error) {
    console.error("Error saat mengambil daftar provinsi:", error);
    res.status(500).send("Terjadi kesalahan saat memuat formulir");
  }
});

app.post("/kabupaten/tambah", requireAuth, async (req, res) => {
  const { nama, provinsiId, diresmikan, photo } = req.body;
  try {
    // Pastikan provinsiId adalah angka
    const provinsiIdNumber = parseInt(provinsiId, 10);

    // Periksa apakah provinsi dengan ID tersebut ada
    const provinsi = await prisma.provinsi.findUnique({
      where: { id: provinsiIdNumber },
    });

    if (!provinsi) {
      return res.status(400).json({ error: "Provinsi tidak ditemukan" });
    }

    // Buat kabupaten baru
    const kabupaten = await prisma.kabupaten.create({
      data: {
        nama,
        diresmikan: new Date(diresmikan),
        photo,
        provinsi: {
          connect: { id: provinsiIdNumber },
        },
      },
    });

    res.redirect("/kabupaten");
  } catch (error) {
    console.error("Error saat membuat kabupaten:", error);
    res.status(500).json({ error: "Terjadi kesalahan saat membuat kabupaten" });
  }
});

app.get("/kabupaten/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const kabupaten = await prisma.kabupaten.findUnique({ where: { id } });
    const provinsis = await prisma.provinsi.findMany({
      select: { id: true, nama: true },
    });
    if (kabupaten) {
      res.render("kabupaten-form", { kabupaten, provinsis });
    } else {
      res.status(404).send("Kabupaten tidak ditemukan");
    }
  } catch (error) {
    console.error("Error saat mengambil data kabupaten:", error);
    res.status(500).send("Terjadi kesalahan saat memuat formulir");
  }
});

app.post("/kabupaten/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { nama, provinsiId, diresmikan, photo } = req.body;
  await prisma.kabupaten.update({
    where: { id },
    data: {
      nama,
      provinsiId: parseInt(provinsiId),
      diresmikan: new Date(diresmikan),
      photo,
    },
  });
  res.redirect("/kabupaten");
});

app.get("/kabupaten/:id/hapus", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.kabupaten.delete({ where: { id } });
  res.redirect("/kabupaten");
});

// Rute untuk halaman registrasi
app.get("/register", (req, res) => {
  res.render("register");
});

// Proses registrasi
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.render("register", { error: "Email sudah terdaftar" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user baru
    await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.render("register", { error: "Terjadi kesalahan saat registrasi" });
  }
});

// Tambahkan rute untuk logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error saat logout:", err);
      return res.status(500).send("Terjadi kesalahan saat logout");
    }
    res.redirect("/login");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));

hbs.registerHelper("formatDate", function (date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
});

hbs.registerHelper("eq", function (a, b) {
  return a === b;
});
