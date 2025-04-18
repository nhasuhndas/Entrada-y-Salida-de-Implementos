// server.js
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(cors());

// Conexión a MySQL
const conexion = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "registro_usuarios"
});

conexion.connect((error) => {
    if (error) {
        console.error("❌ Error de conexión a la base de datos:", error);
    } else {
        console.log("✅ Conectado a la base de datos.");
    }
});

// Subida de imágenes para implementos
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb('Error: Solo imágenes (jpeg, jpg, png, gif)');
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

// IMPLEMENTOS
app.get("/implementos", (req, res) => {
    conexion.query("SELECT * FROM implementos", (err, resultados) => {
        if (err) return res.status(500).json({ error: "Error al obtener implementos" });
        res.json(resultados);
    });
});

app.post("/implementos", upload.single('imagen'), (req, res) => {
    const { nombre, categoria, cantidad } = req.body;
    const imagen_url = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = "INSERT INTO implementos (nombre, categoria, cantidad, imagen_url) VALUES (?, ?, ?, ?)";
    conexion.query(sql, [nombre, categoria, cantidad, imagen_url], (err, resultado) => {
        if (err) return res.status(500).json({ error: "Error al agregar implemento" });
        res.json({ id: resultado.insertId, nombre, categoria, cantidad, imagen_url });
    });
});

app.put("/implementos/:id", upload.single('imagen'), (req, res) => {
    const { nombre, categoria, cantidad } = req.body;
    const { id } = req.params;

    if (req.file) {
        const imagen_url = `/uploads/${req.file.filename}`;
        conexion.query("SELECT imagen_url FROM implementos WHERE id = ?", [id], (err, resultado) => {
            if (resultado[0]?.imagen_url) {
                const rutaAnterior = path.join(__dirname, resultado[0].imagen_url.substring(1));
                if (fs.existsSync(rutaAnterior)) fs.unlinkSync(rutaAnterior);
            }

            const sql = "UPDATE implementos SET nombre = ?, categoria = ?, cantidad = ?, imagen_url = ? WHERE id = ?";
            conexion.query(sql, [nombre, categoria, cantidad, imagen_url, id], (err) => {
                if (err) return res.status(500).json({ error: "Error al actualizar implemento" });
                res.json({ mensaje: "Implemento actualizado" });
            });
        });
    } else {
        const sql = "UPDATE implementos SET nombre = ?, categoria = ?, cantidad = ? WHERE id = ?";
        conexion.query(sql, [nombre, categoria, cantidad, id], (err) => {
            if (err) return res.status(500).json({ error: "Error al actualizar implemento" });
            res.json({ mensaje: "Implemento actualizado" });
        });
    }
});

app.delete("/implementos/:id", (req, res) => {
    const { id } = req.params;
    conexion.query("SELECT imagen_url FROM implementos WHERE id = ?", [id], (err, resultado) => {
        if (resultado[0]?.imagen_url) {
            const ruta = path.join(__dirname, resultado[0].imagen_url.substring(1));
            if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        }
        conexion.query("DELETE FROM implementos WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: "Error al eliminar implemento" });
            res.json({ mensaje: "Implemento eliminado" });
        });
    });
});

// VERIFICACIÓN DE CORREO
app.get("/verificar", (req, res) => {
    const correo = req.query.correo;
    const sql = "SELECT * FROM usuarios WHERE correo = ?";
    conexion.query(sql, [correo], (error, resultados) => {
        if (error) return res.status(500).json({ error: true });
        res.json({ registrado: resultados.length > 0 });
    });
});

app.post("/verificar-correo", (req, res) => {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ registrado: false, mensaje: "Correo no proporcionado." });

    conexion.query("SELECT * FROM usuarios WHERE correo = ?", [correo], (error, resultados) => {
        if (error) return res.status(500).json({ registrado: false, mensaje: "Error de base de datos." });
        res.json({ registrado: resultados.length > 0 });
    });
});

// REGISTRO
app.post("/registro", (req, res) => {
    const { nombres, apellidos, tipo_documento, documento, telefono, correo } = req.body;

    if (!nombres || !apellidos || !tipo_documento || !documento || !telefono || !correo) {
        return res.status(400).json({ mensaje: "❌ Todos los campos son obligatorios." });
    }

    const sql = "INSERT INTO usuarios (nombres, apellidos, tipo_documento, documento, telefono, correo) VALUES (?, ?, ?, ?, ?, ?)";
    conexion.query(sql, [nombres, apellidos, tipo_documento, documento, telefono, correo], (error) => {
        if (error) return res.status(500).json({ mensaje: "❌ Error al registrar en la base de datos." });
        res.json({ mensaje: "✅ Registro exitoso" });
    });
});

// MOSTRAR REGISTROS
app.get("/registros", (req, res) => {
    conexion.query("SELECT * FROM usuarios ORDER BY id DESC", (error, results) => {
        if (error) return res.status(500).send("<h2>❌ Error al obtener los datos.</h2>");

        let html = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Registros</title>
        <style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:10px;text-align:left}
        th{background:#4CAF50;color:#fff}</style></head><body><h2>Lista de Registros</h2>
        <table><thead><tr><th>ID</th><th>Nombre</th><th>Apellido</th><th>Tipo de Documento</th><th>Documento</th><th>Teléfono</th><th>Correo</th></tr></thead><tbody>`;

        results.forEach(r => {
            html += `<tr><td>${r.id}</td><td>${r.nombres}</td><td>${r.apellidos}</td><td>${r.tipo_documento}</td><td>${r.documento}</td><td>${r.telefono}</td><td>${r.correo}</td></tr>`;
        });

        html += `</tbody></table></body></html>`;
        res.send(html);
    });
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
