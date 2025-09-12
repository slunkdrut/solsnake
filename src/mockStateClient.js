// Mock StateClient for development
export class StateClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.appId = config.appId;
    console.log('Mock StateClient initialized with:', config);
  }

  async getEntities(entityType, filters = {}) {
    console.log(`Mock: Getting entities of type ${entityType} with filters:`, filters);
    // Return empty array for now
    return [];
  }

  async getEntity(entityType, id) {
    console.log(`Mock: Getting entity ${entityType} with id ${id}`);
    // Return null for now
    return null;
  }

  async createEntity(entityType, data) {
    console.log(`Mock: Creating entity ${entityType} with data:`, data);
    // Return success
    return { success: true, id: data.id || 'mock-id' };
  }

  async updateEntity(entityType, id, data) {
    console.log(`Mock: Updating entity ${entityType} with id ${id} and data:`, data);
    // Return success
    return { success: true };
  }

  async deleteEntity(entityType, id) {
    console.log(`Mock: Deleting entity ${entityType} with id ${id}`);
    // Return success
    return { success: true };
  }
}
