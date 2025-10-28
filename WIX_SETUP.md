# PipeVault - Wix Integration Setup Guide

## Wix Data Collections Schema

### 1. StorageRequests
**Collection ID**: `StorageRequests`
**Permissions**: Admin: Full, Members: Read own

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique request ID (auto-generated) |
| requestNumber | Text | Yes | Human-readable request number (e.g., "SR-2024-0001") |
| status | Text | Yes | Current status of request |
| customerId | Text | Yes | Wix Member ID |
| customerEmail | Text | Yes | Customer email |
| projectReference | Text | Yes | Customer's project reference number |
| contactName | Text | Yes | Full name of contact person |
| companyName | Text | Yes | Company name |
| phoneNumber | Text | Yes | Contact phone number |
| itemType | Text | Yes | Type of pipe/item |
| itemTypeOther | Text | No | Custom item type if "Other" selected |
| casingOD | Number | No | Outer diameter (mm) |
| casingODInches | Number | No | Outer diameter (inches) |
| casingWeight | Number | No | Weight (lbs/ft) |
| casingID | Number | No | Inner diameter (mm) - calculated |
| casingIDInches | Number | No | Inner diameter (inches) - calculated |
| driftID | Number | No | Drift ID (mm) - calculated |
| driftIDInches | Number | No | Drift ID (inches) - calculated |
| grade | Text | No | Pipe grade (H40, J55, L80, etc.) |
| gradeOther | Text | No | Custom grade if "Other" selected |
| connection | Text | No | Connection type |
| connectionOther | Text | No | Custom connection if "Other" selected |
| threadType | Text | No | Thread type |
| avgJointLength | Number | Yes | Average joint length (meters) |
| totalJoints | Number | Yes | Total number of joints |
| totalLength | Number | Yes | Calculated total length (meters) |
| storageStartDate | Date | Yes | Requested start date |
| storageEndDate | Date | Yes | Requested end date |
| truckingType | Text | No | "mps-quote" or "customer-provided" |
| truckingDetails | Object | No | Trucking information |
| currentLocation | Text | No | Current pipe location (if requesting MPS trucking) |
| assignedYard | Text | No | Assigned yard location at MPS |
| assignedRack | Text | No | Assigned rack location |
| approvedBy | Text | No | Admin user who approved |
| approvedDate | Date | No | Approval timestamp |
| rejectionReason | Text | No | Reason for rejection if applicable |
| specialInstructions | Text | No | Any special instructions |
| createdDate | Date | Auto | Request creation timestamp |
| updatedDate | Date | Auto | Last update timestamp |
| conversationId | Text | No | Link to conversation history |

**Status Values**:
- `draft` - Being created
- `submitted` - Awaiting admin review
- `approved` - Approved, awaiting delivery
- `in-transit` - Pipe being delivered
- `active` - Pipe in storage
- `pickup-requested` - Pickup requested
- `completed` - Storage completed
- `rejected` - Request rejected

---

### 2. Inventory
**Collection ID**: `Inventory`
**Permissions**: Admin: Full, Members: Read own

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique inventory ID |
| requestId | Text | Yes | Reference to StorageRequests |
| customerId | Text | Yes | Wix Member ID |
| customerEmail | Text | Yes | Customer email |
| projectReference | Text | Yes | Project reference number |
| companyName | Text | Yes | Company name |
| itemType | Text | Yes | Type of item |
| specifications | Object | Yes | Full pipe specifications |
| totalJointsOriginal | Number | Yes | Original total joints requested |
| jointsDelivered | Number | Yes | Joints delivered to MPS |
| jointsPickedUp | Number | Yes | Joints picked up from MPS |
| jointsInStorage | Number | Yes | Current joints in storage |
| totalLengthInStorage | Number | Yes | Current total length (meters) |
| yardLocation | Text | No | Current yard location |
| rackLocations | Text | No | Rack location(s) |
| storageStartDate | Date | Yes | Storage start date |
| storageEndDate | Date | Yes | Storage end date |
| lastDeliveryDate | Date | No | Last delivery timestamp |
| lastPickupDate | Date | No | Last pickup timestamp |
| status | Text | Yes | Current inventory status |
| createdDate | Date | Auto | Record creation date |
| updatedDate | Date | Auto | Last update date |

---

### 3. Deliveries
**Collection ID**: `Deliveries`
**Permissions**: Admin: Full, Members: Read own

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique delivery ID |
| deliveryNumber | Text | Yes | Human-readable delivery number |
| requestId | Text | Yes | Reference to StorageRequests |
| customerId | Text | Yes | Wix Member ID |
| customerEmail | Text | Yes | Customer email |
| projectReference | Text | Yes | Project reference number |
| deliveryDate | Date | Yes | Scheduled delivery date |
| deliveryTime | Text | Yes | Scheduled time slot |
| isAfterHours | Boolean | Yes | After-hours delivery flag |
| truckingCompany | Text | Yes | Trucking company name |
| numberOfTrucks | Number | Yes | Number of trucks |
| jointsPerTruck | Number | Yes | Joints per truck |
| totalJointsDelivery | Number | Yes | Total joints in this delivery |
| driverName | Text | No | Driver name |
| driverPhone | Text | No | Driver phone |
| documents | Text | No | Link to uploaded documents |
| assignedYard | Text | No | Assigned yard for storage |
| assignedRacks | Text | No | Assigned rack locations |
| status | Text | Yes | Delivery status |
| actualArrivalTime | Date | No | Actual arrival timestamp |
| completedBy | Text | No | Admin who completed |
| notes | Text | No | Admin notes |
| createdDate | Date | Auto | Record creation date |
| updatedDate | Date | Auto | Last update date |

**Status Values**: `scheduled`, `in-transit`, `arrived`, `completed`, `cancelled`

---

### 4. Pickups
**Collection ID**: `Pickups`
**Permissions**: Admin: Full, Members: Read own

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique pickup ID |
| pickupNumber | Text | Yes | Human-readable pickup number |
| requestId | Text | Yes | Reference to StorageRequests |
| customerId | Text | Yes | Wix Member ID |
| customerEmail | Text | Yes | Customer email |
| projectReference | Text | Yes | Project reference number |
| pickupDate | Date | Yes | Scheduled pickup date |
| pickupTime | Text | Yes | Scheduled time slot |
| isAfterHours | Boolean | Yes | After-hours pickup flag |
| truckingType | Text | Yes | "mps-provided" or "customer-provided" |
| truckingCompany | Text | No | Trucking company name |
| numberOfTrucks | Number | Yes | Number of trucks |
| jointsPerTruck | Number | Yes | Estimated joints per truck |
| totalJointsPickup | Number | Yes | Total joints to pick up |
| totalLengthPickup | Number | Yes | Total length (meters) |
| driverName | Text | No | Driver name |
| driverPhone | Text | No | Driver phone |
| currentYard | Text | No | Current storage yard |
| currentRacks | Text | No | Current rack locations |
| quoteRequested | Boolean | Yes | MPS trucking quote requested |
| quoteProvided | Boolean | No | Quote provided flag |
| quoteAmount | Number | No | Quote amount |
| status | Text | Yes | Pickup status |
| actualPickupTime | Date | No | Actual pickup timestamp |
| completedBy | Text | No | Admin who completed |
| notes | Text | No | Admin notes |
| createdDate | Date | Auto | Record creation date |
| updatedDate | Date | Auto | Last update date |

**Status Values**: `requested`, `quote-pending`, `scheduled`, `in-progress`, `completed`, `cancelled`

---

### 5. Documents
**Collection ID**: `Documents`
**Permissions**: Admin: Full, Members: Read own

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique document ID |
| requestId | Text | No | Related request ID |
| deliveryId | Text | No | Related delivery ID |
| pickupId | Text | No | Related pickup ID |
| customerId | Text | Yes | Wix Member ID |
| customerEmail | Text | Yes | Customer email |
| projectReference | Text | Yes | Project reference number |
| documentType | Text | Yes | "shipping", "bill-of-lading", "inspection", "other" |
| fileName | Text | Yes | Original file name |
| fileUrl | Text | Yes | Wix Media file URL |
| fileType | Text | Yes | "pdf", "excel", "image" |
| parsedData | Object | No | AI-parsed data from document |
| uploadedDate | Date | Auto | Upload timestamp |
| parsedDate | Date | No | AI parsing timestamp |
| parsedBy | Text | No | AI model used for parsing |

---

### 6. Conversations
**Collection ID**: `Conversations`
**Permissions**: Admin: Full, Members: Read own

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique conversation ID |
| requestId | Text | No | Related request ID |
| customerId | Text | Yes | Wix Member ID |
| customerEmail | Text | Yes | Customer email |
| projectReference | Text | No | Project reference (if applicable) |
| conversationType | Text | Yes | "inquiry", "support", "form-help" |
| messages | Text | Yes | JSON array of messages |
| startTime | Date | Yes | Conversation start timestamp |
| endTime | Date | No | Conversation end timestamp |
| isActive | Boolean | Yes | Active conversation flag |
| summary | Text | No | AI-generated summary |
| tags | Text | No | Conversation tags for search |

---

### 7. Notifications
**Collection ID**: `Notifications`
**Permissions**: Admin: Full

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique notification ID |
| type | Text | Yes | Notification type |
| requestId | Text | No | Related request ID |
| customerId | Text | No | Customer ID (if applicable) |
| title | Text | Yes | Notification title |
| message | Text | Yes | Notification message |
| priority | Text | Yes | "low", "medium", "high", "urgent" |
| isRead | Boolean | Yes | Read status (default: false) |
| readBy | Text | No | Admin who read it |
| readDate | Date | No | Read timestamp |
| actionRequired | Boolean | Yes | Requires admin action |
| actionType | Text | No | "approve", "quote", "schedule", etc. |
| relatedData | Object | No | Additional data |
| createdDate | Date | Auto | Notification creation date |

**Notification Types**:
- `new-request` - New storage request submitted
- `quote-requested` - Customer requested MPS trucking quote
- `delivery-scheduled` - Delivery scheduled
- `pickup-requested` - Pickup requested
- `after-hours-request` - After-hours delivery/pickup
- `document-uploaded` - Document uploaded

---

### 8. YardLocations
**Collection ID**: `YardLocations`
**Permissions**: Admin: Full, Members: Read

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| _id | Text | Auto | Unique location ID |
| yardName | Text | Yes | Yard name (e.g., "Yard A") |
| yardType | Text | Yes | "open", "covered", "indoor" |
| areaName | Text | No | Area within yard (e.g., "North Section") |
| rackId | Text | Yes | Unique rack identifier |
| rackName | Text | Yes | Rack display name |
| capacity | Number | Yes | Capacity in joints |
| capacityMeters | Number | Yes | Capacity in meters |
| occupied | Number | Yes | Current occupied joints |
| occupiedMeters | Number | Yes | Current occupied meters |
| available | Number | Yes | Available capacity (joints) |
| availableMeters | Number | Yes | Available capacity (meters) |
| currentRequestId | Text | No | Current request using this rack |
| isActive | Boolean | Yes | Active/inactive flag |
| notes | Text | No | Admin notes |

---

## Wix Backend Structure

Create these files in your Wix Editor:

### Backend Files (`/backend/`)

1. **http-functions.js** - HTTP endpoints for external integrations
2. **data.js** - Data manipulation functions
3. **emails.jsw** - Email sending functions (web module)
4. **ai.jsw** - AI assistant functions (web module)
5. **documents.jsw** - Document parsing functions (web module)
6. **inventory.jsw** - Inventory management functions (web module)
7. **auth.jsw** - Authentication helper functions (web module)

### Public Files (`/public/`)

1. **pages/Home.js** - Home page with 4-tile menu
2. **pages/NewRequest.js** - New storage request page
3. **pages/Inquiry.js** - AI inquiry chatbot page
4. **pages/ScheduleDelivery.js** - Schedule delivery page
5. **pages/RequestPickup.js** - Request pickup page
6. **pages/Admin.js** - Admin dashboard page

---

## Environment Variables (Wix Secrets Manager)

Set these in Wix Secrets Manager:

- `GEMINI_API_KEY` - Google Gemini AI API key
- `ADMIN_EMAILS` - Comma-separated list of admin emails

---

## Wix Member Permissions

### Customer Role (Default Members)
- Can read own StorageRequests
- Can read own Inventory
- Can read own Deliveries
- Can read own Pickups
- Can read own Documents
- Can read own Conversations
- Can read YardLocations

### Admin Role
- Full access to all collections
- Can approve/reject requests
- Can modify inventory
- Can read all notifications

---

## Setup Instructions

1. Create a new Wix site or open existing site
2. Enable Wix Data (Database)
3. Create all collections listed above with specified permissions
4. Enable Wix Members for authentication
5. Install Wix Email Marketing for sending emails
6. Set up Secrets Manager with API keys
7. Create backend files in Velo Code Files panel
8. Import this React app as a custom element (or rebuild in Wix Editor)

---

## Next Steps

After setting up Wix Data Collections, we'll build:

1. 4-Tile Main Menu
2. New Storage Request Form (Accordion sections)
3. AI Inquiry Chatbot
4. Schedule Delivery Form
5. Request Pickup Form
6. Admin Dashboard
7. Email notification system
8. Document upload & AI parsing
9. Real-time inventory tracking
