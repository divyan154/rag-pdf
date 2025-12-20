import express from "express";

import multer from "multer";
import cors from "cors";
import { Queue } from "bullmq";

const app = express();
const queue = new Queue("ProcessPdfQueue", {
  connection: { host: "localhost", port: 6379 },
});
app.use(cors());
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
app.get("/", (req, res) => {
  res.send("Hello from server");
});

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  await queue.add("pdf-process", {
    name: req.file.originalname,
    path: req.file.path,
    destination: req.file.destination,
  });

  res.send({ message: "File uploaded successfully", file: req.file });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
