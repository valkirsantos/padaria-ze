// backend/src/routes/upload.js
// POST /api/upload/produto  — faz upload de uma foto de produto
// Em desenvolvimento: salva em /uploads/ na pasta do projeto
// Em producao: enviar para Cloudflare R2 (substituir a logica abaixo)

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { authStaff } = require("../middlewares/auth");

const router = express.Router();

// Garante que a pasta de uploads existe
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configuração do multer — armazena em disco com nome unico
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Nome: timestamp + extensao original — evita colisoes
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "produto_" + Date.now() + ext);
  },
});

// Validacao: apenas imagens, maximo 5MB
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (tiposPermitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo nao permitido. Use JPG, PNG ou WebP."));
    }
  },
});

// POST /api/upload/produto
router.post("/produto", authStaff, upload.single("foto"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // Em desenvolvimento: retorna URL relativa servida pelo Express
    // Em producao: aqui seria o upload para R2 e retorno da URL publica
    const url = "/uploads/" + req.file.filename;

    console.log("📸 Upload de foto:", req.file.filename);
    res.json({ url, filename: req.file.filename });
  } catch (err) {
    console.error("Erro no upload:", err);
    res.status(500).json({ error: "Erro ao fazer upload da foto" });
  }
});

// Handler de erro do multer (tamanho, tipo, etc)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Arquivo muito grande. Máximo 5MB." });
    }
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
