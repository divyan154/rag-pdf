const express = require("express");
const app = express();

const cors = require("cors");

app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from server");
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
