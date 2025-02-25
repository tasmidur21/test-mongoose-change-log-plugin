const express = require("express");
const mongoose = require("mongoose");
const { changeLogPlugin, setupChangeLogRoutes } = require("mongoose-change-log-plugin");

const app = express();

// Example Schema with the changeLogPlugin
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
});
userSchema.plugin(changeLogPlugin);

const User = mongoose.model("User", userSchema);
mongoose.connect("mongodb://localhost:27017/mongoose-change-log-plugin-test")
.then(() => 
  setupChangeLogRoutes(app, { viewPath: "/logs", apiPath: "/api" })
)

// Setup change log routes under the /logs path
setupChangeLogRoutes(app, { viewPath: "/logs", apiPath: "/api" });


const userCreate = async (payload) => {
  await mongoose.connect("mongodb://localhost:27017/mongoose-change-log-plugin-test")
  await User.create([payload]);
}

// Sample POST route to create a new user
app.post("/users", async (req, res) => {
  try {
    const newUser = new User({
      name: "John Doe",
      email: "johndoe@example.com",
    });
    await newUser.save();
    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating user", error });
  }
});

// Sample PUT route to update a user
app.put("/users/:id", async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name: "John Doe Updated" },
      { new: true }
    );
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating user", error });
  }
});

// Sample DELETE route to delete a user
app.delete("/users/:id", async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: deletedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting user", error });
  }
});

// Start the server
app.listen(3029, () => {
  console.log("Server is running on http://localhost:3029");
  //await getConnection();
 
  // for(let i=0;i<1;i++){
  //   let payload={ name: `John-${i}`, email: `john${i}@example.com` }
  //    userCreate(payload).then(res=>console.log(res))
  // }

});
