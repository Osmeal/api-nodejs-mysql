import express from "express";
import { pool } from "./db.js";
import { hashPassword } from "./hashPassword.js";
import bcrypt from "bcryptjs";
import {PORT} from './config.js'

const app = express();
app.use(express.json());

//Test
app.get("/ping", async (req, res) => {
  const [result] = await pool.query(`SELECT "HELLO WORLD" as RESULT`);
  res.json(result);
});

//Lista gimnasios********
app.get("/", async (req, res) => {
  const [result] = await pool.query(`SELECT * FROM gyms`);
  res.json(result);
});

//Lista clases********
app.post("/classes", async (req, res) => {
  try {
    const { gym_id } = req.body;

    const [result] = await pool.query(
      `SELECT * FROM classes WHERE gym_id = ?`,
      [gym_id]
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las clases" });
  }
});  

//Obtener usuario********
app.post("/user", async (req, res) => {
  try {
    const { email, password } = req.body;

    //Buscar usuario por email
    const [rows] = await pool.query(`SELECT * FROM users WHERE email = ?`, [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const user = rows[0];

    //Comparar contraseña
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    //Devolver usuario (sin contraseña por seguridad)
    delete user.password;

    res.json({ message: "Usuario autenticado", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

//Añadir usuario********
app.post("/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await hashPassword(password);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
      [name, email, hashedPassword]
    );

    res
      .status(201)
      .json({ message: "Usuario creado", userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

//Eliminar usuario********
app.delete("/users", async (req, res) => {
  try {
    const id = req.query.id;

    const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [id]);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

//Añadir asistente a clase********
app.post("/classes/:id/add-user", async (req, res) => {
  try {
    const classId = req.params.id;
    const { user_id } = req.body;

    // Verificar si la clase existe y tiene espacio
    const [classData] = await pool.query(
      `SELECT capacity FROM classes WHERE id = ?`,
      [classId]
    );

    if (classData.length === 0) {
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    const [currentUsers] = await pool.query(
      `SELECT COUNT(*) AS count FROM class_users WHERE class_id = ?`,
      [classId]
    );

    if (currentUsers[0].count >= classData[0].capacity) {
      return res.status(400).json({ error: "La clase ya está llena" });
    }

    // Verificar si el usuario ya está apuntado
    const [existing] = await pool.query(
      `SELECT * FROM class_users WHERE class_id = ? AND user_id = ?`,
      [classId, user_id]
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ error: "El usuario ya está apuntado a esta clase" });
    }

    // Insertar en la tabla intermedia
    const [insertResult] = await pool.query(
      `INSERT INTO class_users (class_id, user_id) VALUES (?, ?)`,
      [classId, user_id]
    );

    // Sumar 1 al contador de usuarios en la tabla classes
    await pool.query(
      `UPDATE classes SET users = users + 1 WHERE id = ?`,
      [classId]
    );

    res.json({ message: "Usuario añadido a la clase", insertResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al añadir usuario a la clase" });
  }
});

//Comprobar si usuario ya está apuntado********
app.post("/classes/:id/check-user", async (req, res) => {
  try {
    const classId = req.params.id;
    const { user_id } = req.body;

    const [rows] = await pool.query(
      `SELECT * FROM class_users WHERE class_id = ? AND user_id = ?`,
      [classId, user_id]
    );

    const reservado = rows.length > 0;
    res.json({ reservado });
  } catch (error) {
    console.error("Error comprobando usuario en clase:", error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

//Eliminar asistente a clase********
app.delete("/classes/:id/remove-user", async (req, res) => {
  try {
    const classId = req.params.id;
    const { user_id } = req.body;

    // Verificar si la clase existe
    const [classData] = await pool.query(`SELECT * FROM classes WHERE id = ?`, [
      classId,
    ]);

    if (classData.length === 0) {
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    // Verificar si el usuario está apuntado a la clase
    const [existing] = await pool.query(
      `SELECT * FROM class_users WHERE class_id = ? AND user_id = ?`,
      [classId, user_id]
    );

    if (existing.length === 0) {
      return res
        .status(400)
        .json({ error: "El usuario no está apuntado a esta clase" });
    }

    // Eliminar al usuario de la clase
    const [deleteResult] = await pool.query(
      `DELETE FROM class_users WHERE class_id = ? AND user_id = ?`,
      [classId, user_id]
    );

    // Restar 1 al contador de users en la clase
    await pool.query(
      `UPDATE classes SET users = users - 1 WHERE id = ? AND users > 0`,
      [classId]
    );

    res.json({ message: "Usuario quitado de la clase", deleteResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al quitar usuario de la clase" });
  }
});

//Añadir gimnasio********
app.post("/gym", async (req, res) => {
  try {
    const { name, address, phone, photo } = req.body;

    const [result] = await pool.query(
      `INSERT INTO gyms (name, address, phone, photo) VALUES (?, ?, ?, ?)`,
      [name, address, phone, photo]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al insertar gimnasio" });
  }
});

//Añadir clase********
app.post("/class", async (req, res) => {
  try {
    const {
      gym_id,
      name,
      instructor,
      users,
      capacity,
      start_time,
      finish_time,
      photo,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO classes (gym_id, name, instructor, users, capacity, start_time, finish_time, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gym_id,
        name,
        instructor,
        users,
        capacity,
        start_time,
        finish_time,
        photo,
      ]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al insertar clase" });
  }
});

//Eliminar gimnasio********
app.delete("/gym", async (req, res) => {
  try {
    const id = req.query.id;

    const [result] = await pool.query(`DELETE FROM gyms WHERE id = ?`, [id]);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar gimnasio" });
  }
});

//Eliminar clase********
app.delete("/class", async (req, res) => {
  try {
    const id = req.query.id;

    const [result] = await pool.query(`DELETE FROM classes WHERE id = ?`, [id]);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar clase" });
  }
});

//Obtener usuarios de una clase********
app.get("/classes/:id/users", async (req, res) => {
  try {
    const classId = req.params.id;

    // Verificar si la clase existe
    const [classData] = await pool.query(`SELECT * FROM classes WHERE id = ?`, [
      classId,
    ]);

    if (classData.length === 0) {
      return res.status(404).json({ error: "Clase no encontrada" });
    }

    // Obtener los usuarios apuntados a la clase
    const [users] = await pool.query(
      `
      SELECT u.id, u.name, u.email
      FROM class_users cu
      JOIN users u ON cu.user_id = u.id
      WHERE cu.class_id = ?
      `,
      [classId]
    );

    res.json({ classId, users });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Error al obtener los usuarios de la clase" });
  }
});

//Obtener horario********
app.get("/schedule/:id", async (req, res) => {
  const gymId = req.params.id;

  try {
    const [result] = await pool.query(
      `SELECT schedule FROM gyms WHERE id = ?`,
      [gymId]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "Gimnasio no encontrado" });
    }

    res.json(result[0]);
  } catch (err) {
    console.error("Error al obtener el horario:", err);
    res.status(500).json({ error: "Error al obtener el horario" });
  }
});


app.listen(PORT);
console.log("Server on port", PORT);
