const mongoose = require('mongoose');

// Constants for action types
const ACTION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

/**
 * Mongoose plugin to log changes (create, update, delete) to documents.
 * @param {mongoose.Schema} schema - The Mongoose schema to attach the plugin to.
 * @param {Object} options - Configuration options.
 * @param {mongoose.Model} options.logCollection - The Mongoose model for storing logs.
 * @param {boolean} [options.softDelete=false] - Whether to treat deletes as soft deletes (log after state).
 */
function changeLogPlugin(schema, options = {}) {
  const logCollection = options.logCollection;
  const softDelete = options.softDelete || false;

  // Validate required options
  if (!logCollection) {
    throw new Error('logCollection must be provided in options');
  }

  // Helper to save log entries
  const saveLog = async (action, modelName, docId, before, after) => {
    try {
      const log = new logCollection({
        action,
        modelName,
        documentId: docId || null,
        before,
        after,
        timestamp: new Date(),
      });
      await log.save();
    } catch (err) {
      console.error('Error saving log:', err);
    }
  };

  // Helper to fetch documents based on query filter
  const fetchDocuments = async (model, filter) => {
    return model.find(filter);
  };

  // **Save Hook (create or update)**
  schema.pre('save', async function (next) {
    this._isNew = this.isNew;
    this._beforeState = this.isNew ? null : await this.constructor.findOne({ _id: this._id });
    this._afterState = this.toObject();
    next();
  });

  schema.post('save', async function (doc) {
    const action = this._isNew ? ACTION_TYPES.CREATE : ACTION_TYPES.UPDATE;
    await saveLog(action, this.constructor.modelName, this._id, this._beforeState, this._afterState);
  });

  // **DeleteOne Hook (document-based)**
  schema.pre('deleteOne', { document: true, query: false }, async function (next) {
    this._beforeState = this.toObject();
    next();
  });

  schema.post('deleteOne', { document: true, query: false }, async function (doc) {
    const afterState = softDelete ? this.toObject() : null;
    await saveLog(ACTION_TYPES.DELETE, this.constructor.modelName, this._id, this._beforeState, afterState);
  });

  // **DeleteOne Hook (query-based)**
  schema.pre('deleteOne', { document: false, query: true }, async function (next) {
    this._beforeState = await fetchDocuments(this.model, this.getFilter());
    next();
  });

  schema.post('deleteOne', { document: false, query: true }, async function (result) {
    if (this._beforeState && this._beforeState.length > 0) {
      const doc = this._beforeState[0];
      const afterState = softDelete ? await this.model.findById(doc._id) : null;
      await saveLog(ACTION_TYPES.DELETE, this.model.modelName, doc._id, doc.toObject(), afterState);
    }
  });

  // **DeleteMany Hook**
  schema.pre('deleteMany', async function (next) {
    this._affectedDocs = await fetchDocuments(this.model, this.getFilter());
    next();
  });

  schema.post('deleteMany', async function (result) {
    if (this._affectedDocs) {
      for (const doc of this._affectedDocs) {
        const afterState = softDelete ? await this.model.findById(doc._id) : null;
        await saveLog(ACTION_TYPES.DELETE, this.model.modelName, doc._id, doc.toObject(), afterState);
      }
    }
  });

  // **UpdateOne Hook**
  schema.pre('updateOne', async function (next) {
    this._beforeState = await fetchDocuments(this.model, this.getFilter());
    this._updatePayload = this.getUpdate();
    next();
  });

  schema.post('updateOne', async function (result) {
    if (this._beforeState && this._beforeState.length > 0) {
      const doc = this._beforeState[0];
      const afterState = await this.model.findById(doc._id);
      await saveLog(ACTION_TYPES.UPDATE, this.model.modelName, doc._id, doc.toObject(), afterState || this._updatePayload);
    }
  });

  // **UpdateMany Hook**
  schema.pre('updateMany', async function (next) {
    this._affectedDocs = await fetchDocuments(this.model, this.getFilter());
    this._updatePayload = this.getUpdate();
    next();
  });

  schema.post('updateMany', async function (result) {
    if (this._affectedDocs) {
      for (const doc of this._affectedDocs) {
        const afterState = await this.model.findById(doc._id);
        await saveLog(ACTION_TYPES.UPDATE, this.model.modelName, doc._id, doc.toObject(), afterState || this._updatePayload);
      }
    }
  });

  // **FindOneAndDelete Hook**
  schema.pre('findOneAndDelete', async function (next) {
    this._beforeState = await fetchDocuments(this.model, this.getFilter());
    next();
  });

  schema.post('findOneAndDelete', async function (doc) {
    if (this._beforeState && this._beforeState.length > 0) {
      const beforeDoc = this._beforeState[0];
      const afterState = softDelete ? await this.model.findById(beforeDoc._id) : null;
      await saveLog(ACTION_TYPES.DELETE, this.model.modelName, beforeDoc._id, beforeDoc.toObject(), afterState);
    }
  });

  // **FindOneAndUpdate Hook**
  schema.pre('findOneAndUpdate', async function (next) {
    this._beforeState = await fetchDocuments(this.model, this.getFilter());
    this._updatePayload = this.getUpdate();
    next();
  });

  schema.post('findOneAndUpdate', async function (doc) {
    if (this._beforeState && this._beforeState.length > 0) {
      const beforeDoc = this._beforeState[0];
      const afterState = doc || await this.model.findById(beforeDoc._id);
      await saveLog(ACTION_TYPES.UPDATE, this.model.modelName, beforeDoc._id, beforeDoc.toObject(), afterState || this._updatePayload);
    }
  });
}

module.exports = changeLogPlugin;