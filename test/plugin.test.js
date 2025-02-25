const mongoose = require('mongoose');
const { expect } = require('chai');
const changeLogPlugin = require('../src/index'); // Adjust the path to your plugin file

// Define Log Schema
const LogSchema = new mongoose.Schema({
  action: String,
  modelName: String,
  documentId: mongoose.Schema.Types.ObjectId,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  timestamp: Date,
});

const Log = mongoose.model('Log', LogSchema);

// Define User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});

// Apply the plugin with the logCollection option
UserSchema.plugin(changeLogPlugin, { logCollection: Log });

const User = mongoose.model('User', UserSchema);

describe('Mongoose Change Log Plugin', () => {
  // Connect to the test database before all tests
  before(async () => {
    await mongoose.connect('mongodb://localhost:27017/mongoose-change-log-plugin-test-db');
  });

  // Clear the User and Log collections before each test
  beforeEach(async () => {
    await User.deleteMany({});
    await Log.deleteMany({});
  });

  // Drop the database and close the connection after all tests
  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  // Test case for creating a new document
  it('should log "create" action with null before and full after payload', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();

    const logs = await Log.find({ documentId: user._id });
    expect(logs).to.have.lengthOf(1);
    expect(logs[0].action).to.equal('create');
    expect(logs[0].before).to.be.null;
    expect(logs[0].after).to.include({ name: 'John', email: 'john@example.com' });
  });

  // Test case for updating via save
  it('should log "update" action with before and after payloads for save update', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();
    user.name = 'John Doe';
    await user.save();

    const logs = await Log.find({ documentId: user._id }).sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(2);
    expect(logs[0].action).to.equal('create');
    expect(logs[1].action).to.equal('update');
    expect(logs[1].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(logs[1].after).to.include({ name: 'John Doe', email: 'john@example.com' });
  });

  // Test case for document-based deleteOne
  it('should log "delete" action with before payload and null after for deleteOne (document-based)', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();
    await user.deleteOne();

    const logs = await Log.find({ documentId: user._id }).sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(3);
    expect(logs[0].action).to.equal('create');
    expect(logs[1].action).to.equal('delete');
    expect(logs[1].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(logs[1].after).to.be.null;
  });

  // Test case for query-based deleteOne
  it('should log "delete" action with before payload and null after for deleteOne (query-based)', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();
    await User.deleteOne({ _id: user._id });

    const logs = await Log.find({ documentId: user._id }).sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(2);
    expect(logs[0].action).to.equal('create');
    expect(logs[1].action).to.equal('delete');
    expect(logs[1].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(logs[1].after).to.be.null;
  });

  // Test case for deleteMany
  it('should log "delete" action for multiple documents with deleteMany', async () => {
    const user1 = new User({ name: 'John', email: 'john@example.com' });
    const user2 = new User({ name: 'Jane', email: 'jane@example.com' });
    await Promise.all([user1.save(), user2.save()]);
    await User.deleteMany({});

    const logs = await Log.find().sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(4); // 2 creates + 2 deletes
    const deleteLogs = logs.filter(log => log.action === 'delete');
    expect(deleteLogs).to.have.lengthOf(2);
    expect(deleteLogs[0].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(deleteLogs[0].after).to.be.null;
    expect(deleteLogs[1].before).to.include({ name: 'Jane', email: 'jane@example.com' });
    expect(deleteLogs[1].after).to.be.null;
  });

  // Test case for updateOne
  it('should log "update" action with before and after payloads for updateOne', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();
    await User.updateOne({ _id: user._id }, { name: 'John Doe' });

    const logs = await Log.find({ documentId: user._id }).sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(2);
    expect(logs[0].action).to.equal('create');
    expect(logs[1].action).to.equal('update');
    expect(logs[1].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(logs[1].after).to.include({ name: 'John Doe', email: 'john@example.com' });
  });

  // Test case for updateMany
  it('should log "update" action for multiple documents with updateMany', async () => {
    const user1 = new User({ name: 'John', email: 'john@example.com' });
    const user2 = new User({ name: 'Jane', email: 'jane@example.com' });
    await Promise.all([user1.save(), user2.save()]);
    await User.updateMany({}, { email: 'updated@example.com' });

    const logs = await Log.find().sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(4); // 2 creates + 2 updates
    const updateLogs = logs.filter(log => log.action === 'update');
    expect(updateLogs).to.have.lengthOf(2);
    expect(updateLogs[0].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(updateLogs[0].after).to.include({ name: 'John', email: 'updated@example.com' });
    expect(updateLogs[1].before).to.include({ name: 'Jane', email: 'jane@example.com' });
    expect(updateLogs[1].after).to.include({ name: 'Jane', email: 'updated@example.com' });
  });

  // Test case for findOneAndDelete
  it('should log "delete" action with before payload and null after for findOneAndDelete', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();
    await User.findOneAndDelete({ _id: user._id });

    const logs = await Log.find({ documentId: user._id }).sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(2);
    expect(logs[0].action).to.equal('create');
    expect(logs[1].action).to.equal('delete');
    expect(logs[1].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(logs[1].after).to.be.null;
  });

  // Test case for findOneAndUpdate
  it('should log "update" action with before and after payloads for findOneAndUpdate', async () => {
    const user = new User({ name: 'John', email: 'john@example.com' });
    await user.save();
    await User.findOneAndUpdate({ _id: user._id }, { name: 'John Doe' }, { new: true });

    const logs = await Log.find({ documentId: user._id }).sort({ timestamp: 1 });
    expect(logs).to.have.lengthOf(2);
    expect(logs[0].action).to.equal('create');
    expect(logs[1].action).to.equal('update');
    expect(logs[1].before).to.include({ name: 'John', email: 'john@example.com' });
    expect(logs[1].after).to.include({ name: 'John Doe', email: 'john@example.com' });
  });

  // Test case for missing logCollection option
  it('should throw an error if logCollection is not provided', () => {
    const InvalidSchema = new mongoose.Schema({ name: String });
    expect(() => InvalidSchema.plugin(changeLogPlugin)).to.throw('logCollection must be provided in options');
  });
});