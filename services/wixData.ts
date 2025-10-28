// Mock Wix Data Service for local development
// In production, this will be replaced with actual Wix Data API calls

import type {
  StorageRequest,
  Inventory,
  Delivery,
  Pickup,
  Document,
  Conversation,
  Notification,
  YardLocation,
  ApiResponse,
} from '../types';

// Mock in-memory database
const mockDatabase = {
  storageRequests: [] as StorageRequest[],
  inventory: [] as Inventory[],
  deliveries: [] as Delivery[],
  pickups: [] as Pickup[],
  documents: [] as Document[],
  conversations: [] as Conversation[],
  notifications: [] as Notification[],
  yardLocations: [] as YardLocation[],
};

// Initialize with some sample yard locations
const initializeYards = () => {
  if (mockDatabase.yardLocations.length === 0) {
    mockDatabase.yardLocations = [
      {
        _id: 'yard-a-n-1',
        yardName: 'Yard A',
        yardType: 'open',
        areaName: 'North Section',
        rackId: 'A-N-1',
        rackName: 'Rack A-N-1',
        capacity: 75,
        capacityMeters: 900,
        occupied: 0,
        occupiedMeters: 0,
        available: 75,
        availableMeters: 900,
        isActive: true,
      },
      {
        _id: 'yard-a-n-2',
        yardName: 'Yard A',
        yardType: 'open',
        areaName: 'North Section',
        rackId: 'A-N-2',
        rackName: 'Rack A-N-2',
        capacity: 75,
        capacityMeters: 900,
        occupied: 0,
        occupiedMeters: 0,
        available: 75,
        availableMeters: 900,
        isActive: true,
      },
      {
        _id: 'yard-b-s-1',
        yardName: 'Yard B',
        yardType: 'covered',
        areaName: 'South Section',
        rackId: 'B-S-1',
        rackName: 'Rack B-S-1',
        capacity: 100,
        capacityMeters: 1200,
        occupied: 0,
        occupiedMeters: 0,
        available: 100,
        availableMeters: 1200,
        isActive: true,
      },
    ];
  }
};

initializeYards();

// Generate unique ID
const generateId = () => {
  return `_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Generate request number
let requestCounter = 1;
const generateRequestNumber = (): string => {
  const year = new Date().getFullYear();
  const number = String(requestCounter++).padStart(4, '0');
  return `SR-${year}-${number}`;
};

// Generate delivery number
let deliveryCounter = 1;
const generateDeliveryNumber = (): string => {
  const year = new Date().getFullYear();
  const number = String(deliveryCounter++).padStart(4, '0');
  return `DL-${year}-${number}`;
};

// Generate pickup number
let pickupCounter = 1;
const generatePickupNumber = (): string => {
  const year = new Date().getFullYear();
  const number = String(pickupCounter++).padStart(4, '0');
  return `PU-${year}-${number}`;
};

// ========== STORAGE REQUESTS ==========

export const createStorageRequest = async (
  data: Omit<StorageRequest, '_id' | 'requestNumber' | 'createdDate' | 'updatedDate'>
): Promise<ApiResponse<StorageRequest>> => {
  try {
    const request: StorageRequest = {
      ...data,
      _id: generateId(),
      requestNumber: generateRequestNumber(),
      createdDate: new Date(),
      updatedDate: new Date(),
    };
    mockDatabase.storageRequests.push(request);
    return { success: true, data: request };
  } catch (error) {
    return { success: false, error: 'Failed to create storage request' };
  }
};

export const getStorageRequest = async (id: string): Promise<ApiResponse<StorageRequest>> => {
  const request = mockDatabase.storageRequests.find((r) => r._id === id);
  if (request) {
    return { success: true, data: request };
  }
  return { success: false, error: 'Storage request not found' };
};

export const getStorageRequestsByCustomer = async (
  customerEmail: string
): Promise<ApiResponse<StorageRequest[]>> => {
  const requests = mockDatabase.storageRequests.filter(
    (r) => r.customerEmail === customerEmail
  );
  return { success: true, data: requests };
};

export const getStorageRequestByProjectRef = async (
  customerEmail: string,
  projectReference: string
): Promise<ApiResponse<StorageRequest>> => {
  const request = mockDatabase.storageRequests.find(
    (r) => r.customerEmail === customerEmail && r.projectReference === projectReference
  );
  if (request) {
    return { success: true, data: request };
  }
  return { success: false, error: 'Storage request not found for this project reference' };
};

export const updateStorageRequest = async (
  id: string,
  updates: Partial<StorageRequest>
): Promise<ApiResponse<StorageRequest>> => {
  const index = mockDatabase.storageRequests.findIndex((r) => r._id === id);
  if (index !== -1) {
    mockDatabase.storageRequests[index] = {
      ...mockDatabase.storageRequests[index],
      ...updates,
      updatedDate: new Date(),
    };
    return { success: true, data: mockDatabase.storageRequests[index] };
  }
  return { success: false, error: 'Storage request not found' };
};

export const getAllStorageRequests = async (): Promise<ApiResponse<StorageRequest[]>> => {
  return { success: true, data: mockDatabase.storageRequests };
};

// ========== INVENTORY ==========

export const createInventory = async (
  data: Omit<Inventory, '_id' | 'createdDate' | 'updatedDate'>
): Promise<ApiResponse<Inventory>> => {
  try {
    const inventory: Inventory = {
      ...data,
      _id: generateId(),
      createdDate: new Date(),
      updatedDate: new Date(),
    };
    mockDatabase.inventory.push(inventory);
    return { success: true, data: inventory };
  } catch (error) {
    return { success: false, error: 'Failed to create inventory' };
  }
};

export const getInventoryByCustomer = async (
  customerEmail: string
): Promise<ApiResponse<Inventory[]>> => {
  const inventory = mockDatabase.inventory.filter((i) => i.customerEmail === customerEmail);
  return { success: true, data: inventory };
};

export const getInventoryByProjectRef = async (
  customerEmail: string,
  projectReference: string
): Promise<ApiResponse<Inventory>> => {
  const inventory = mockDatabase.inventory.find(
    (i) => i.customerEmail === customerEmail && i.projectReference === projectReference
  );
  if (inventory) {
    return { success: true, data: inventory };
  }
  return { success: false, error: 'Inventory not found for this project reference' };
};

export const updateInventory = async (
  id: string,
  updates: Partial<Inventory>
): Promise<ApiResponse<Inventory>> => {
  const index = mockDatabase.inventory.findIndex((i) => i._id === id);
  if (index !== -1) {
    mockDatabase.inventory[index] = {
      ...mockDatabase.inventory[index],
      ...updates,
      updatedDate: new Date(),
    };
    return { success: true, data: mockDatabase.inventory[index] };
  }
  return { success: false, error: 'Inventory not found' };
};

// ========== DELIVERIES ==========

export const createDelivery = async (
  data: Omit<Delivery, '_id' | 'deliveryNumber' | 'createdDate' | 'updatedDate'>
): Promise<ApiResponse<Delivery>> => {
  try {
    const delivery: Delivery = {
      ...data,
      _id: generateId(),
      deliveryNumber: generateDeliveryNumber(),
      createdDate: new Date(),
      updatedDate: new Date(),
    };
    mockDatabase.deliveries.push(delivery);
    return { success: true, data: delivery };
  } catch (error) {
    return { success: false, error: 'Failed to create delivery' };
  }
};

export const getDeliveriesByCustomer = async (
  customerEmail: string
): Promise<ApiResponse<Delivery[]>> => {
  const deliveries = mockDatabase.deliveries.filter((d) => d.customerEmail === customerEmail);
  return { success: true, data: deliveries };
};

export const updateDelivery = async (
  id: string,
  updates: Partial<Delivery>
): Promise<ApiResponse<Delivery>> => {
  const index = mockDatabase.deliveries.findIndex((d) => d._id === id);
  if (index !== -1) {
    mockDatabase.deliveries[index] = {
      ...mockDatabase.deliveries[index],
      ...updates,
      updatedDate: new Date(),
    };
    return { success: true, data: mockDatabase.deliveries[index] };
  }
  return { success: false, error: 'Delivery not found' };
};

// ========== PICKUPS ==========

export const createPickup = async (
  data: Omit<Pickup, '_id' | 'pickupNumber' | 'createdDate' | 'updatedDate'>
): Promise<ApiResponse<Pickup>> => {
  try {
    const pickup: Pickup = {
      ...data,
      _id: generateId(),
      pickupNumber: generatePickupNumber(),
      createdDate: new Date(),
      updatedDate: new Date(),
    };
    mockDatabase.pickups.push(pickup);
    return { success: true, data: pickup };
  } catch (error) {
    return { success: false, error: 'Failed to create pickup' };
  }
};

export const getPickupsByCustomer = async (
  customerEmail: string
): Promise<ApiResponse<Pickup[]>> => {
  const pickups = mockDatabase.pickups.filter((p) => p.customerEmail === customerEmail);
  return { success: true, data: pickups };
};

export const updatePickup = async (
  id: string,
  updates: Partial<Pickup>
): Promise<ApiResponse<Pickup>> => {
  const index = mockDatabase.pickups.findIndex((p) => p._id === id);
  if (index !== -1) {
    mockDatabase.pickups[index] = {
      ...mockDatabase.pickups[index],
      ...updates,
      updatedDate: new Date(),
    };
    return { success: true, data: mockDatabase.pickups[index] };
  }
  return { success: false, error: 'Pickup not found' };
};

// ========== NOTIFICATIONS ==========

export const createNotification = async (
  data: Omit<Notification, '_id' | 'createdDate'>
): Promise<ApiResponse<Notification>> => {
  try {
    const notification: Notification = {
      ...data,
      _id: generateId(),
      createdDate: new Date(),
    };
    mockDatabase.notifications.push(notification);
    return { success: true, data: notification };
  } catch (error) {
    return { success: false, error: 'Failed to create notification' };
  }
};

export const getNotifications = async (): Promise<ApiResponse<Notification[]>> => {
  return { success: true, data: mockDatabase.notifications };
};

export const getUnreadNotifications = async (): Promise<ApiResponse<Notification[]>> => {
  const unread = mockDatabase.notifications.filter((n) => !n.isRead);
  return { success: true, data: unread };
};

export const markNotificationAsRead = async (
  id: string,
  readBy: string
): Promise<ApiResponse<Notification>> => {
  const index = mockDatabase.notifications.findIndex((n) => n._id === id);
  if (index !== -1) {
    mockDatabase.notifications[index] = {
      ...mockDatabase.notifications[index],
      isRead: true,
      readBy,
      readDate: new Date(),
    };
    return { success: true, data: mockDatabase.notifications[index] };
  }
  return { success: false, error: 'Notification not found' };
};

// ========== YARD LOCATIONS ==========

export const getAvailableYardLocations = async (
  requiredJoints: number
): Promise<ApiResponse<YardLocation[]>> => {
  const available = mockDatabase.yardLocations.filter(
    (y) => y.isActive && y.available >= requiredJoints
  );
  return { success: true, data: available };
};

export const updateYardLocation = async (
  id: string,
  updates: Partial<YardLocation>
): Promise<ApiResponse<YardLocation>> => {
  const index = mockDatabase.yardLocations.findIndex((y) => y._id === id);
  if (index !== -1) {
    mockDatabase.yardLocations[index] = {
      ...mockDatabase.yardLocations[index],
      ...updates,
    };
    return { success: true, data: mockDatabase.yardLocations[index] };
  }
  return { success: false, error: 'Yard location not found' };
};

// ========== CONVERSATIONS ==========

export const createConversation = async (
  data: Omit<Conversation, '_id'>
): Promise<ApiResponse<Conversation>> => {
  try {
    const conversation: Conversation = {
      ...data,
      _id: generateId(),
    };
    mockDatabase.conversations.push(conversation);
    return { success: true, data: conversation };
  } catch (error) {
    return { success: false, error: 'Failed to create conversation' };
  }
};

export const updateConversation = async (
  id: string,
  updates: Partial<Conversation>
): Promise<ApiResponse<Conversation>> => {
  const index = mockDatabase.conversations.findIndex((c) => c._id === id);
  if (index !== -1) {
    mockDatabase.conversations[index] = {
      ...mockDatabase.conversations[index],
      ...updates,
    };
    return { success: true, data: mockDatabase.conversations[index] };
  }
  return { success: false, error: 'Conversation not found' };
};

// ========== DOCUMENTS ==========

export const createDocument = async (
  data: Omit<Document, '_id' | 'uploadedDate'>
): Promise<ApiResponse<Document>> => {
  try {
    const document: Document = {
      ...data,
      _id: generateId(),
      uploadedDate: new Date(),
    };
    mockDatabase.documents.push(document);
    return { success: true, data: document };
  } catch (error) {
    return { success: false, error: 'Failed to create document' };
  }
};

export const getDocumentsByProjectRef = async (
  customerEmail: string,
  projectReference: string
): Promise<ApiResponse<Document[]>> => {
  const documents = mockDatabase.documents.filter(
    (d) => d.customerEmail === customerEmail && d.projectReference === projectReference
  );
  return { success: true, data: documents };
};
