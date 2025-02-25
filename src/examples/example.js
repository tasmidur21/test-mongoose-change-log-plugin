// server.js
const express = require('express');
const mongoose = require('mongoose');
const changeLogPlugin = require('../index'); // Adjust path as needed
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./api-doc.json');
const path = require('path')

const app = express();
app.use(express.json());

// Log Schema
const LogSchema = new mongoose.Schema({
  action: String,
  modelName: String,
  documentId: mongoose.Schema.Types.ObjectId,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  timestamp: Date,
});

const Log = mongoose.model('Log', LogSchema);

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});
UserSchema.plugin(changeLogPlugin, { logCollection: Log });

const User = mongoose.model('User', UserSchema);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/express-change-log-demo')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

  

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/change-log-ui', express.static(path.join(__dirname, '../public')))

// Create a single user
app.post('/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get a user by ID
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a single user (findOneAndUpdate)
app.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a single user (findOneAndDelete)
app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get change logs for a user
app.get('/logs/:type/:id', async (req, res) => {
  try {
    const logs = await Log.find({ 
        modelName:req.params?.type,
        documentId: req.params?.id 
    }).sort({ timestamp: 1 });
    res.json(logs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/model-logs', async (req, res) => {
    try {
        const modelNames = await Log.aggregate([
            {
              $group: {
                _id: "$modelName"
              }
            },
            {
              $project: {
                _id: 0,
                modelName: "$_id"
              }
            }
          ]);
          res.json(modelNames);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });



// New logs route with query parameters
app.get("/logs", async (req, res) => {
    try {
      const {
        modelName,
        documentId,
        action,
        startTimestamp,
        endTimestamp
      } = req.query;
  
      // Build query object
      let query = {};
  
      if (modelName) {
        query.modelName = modelName;
      }
      if (documentId) {
        query.documentId = documentId;
      }
      if (action) {
        query.action = action;
      }
      if (startTimestamp || endTimestamp) {
        query.timestamp = {};
        if (startTimestamp) {
          query.timestamp.$gte = new Date(startTimestamp);
        }
        if (endTimestamp) {
          query.timestamp.$lte = new Date(endTimestamp);
        }
      }
  
      const logs = await Log.find(query).sort({ timestamp: 1 });
      res.json(logs);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

// NEW: Get all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Batch update users (updateMany)
app.put('/users', async (req, res) => {
  try {
    const result = await User.updateMany({}, req.body, { runValidators: true });
    res.json({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Batch delete users (deleteMany)
app.delete('/users', async (req, res) => {
  try {
    const result = await User.deleteMany({});
    res.json({
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Get all logs
app.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NEW: Clear all data (useful for testing)
app.delete('/reset', async (req, res) => {
  try {
    await User.deleteMany({});
    await Log.deleteMany({});
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});