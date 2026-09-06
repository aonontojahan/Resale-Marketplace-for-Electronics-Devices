# 📱 ReSale - Premium Electronics Marketplace

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3)](https://developer.mozilla.org/en-US/docs/Web/CSS)

ReSale is a high-end, secure resale marketplace tailored for pre-owned electronics in Bangladesh. Built with a focus on trust and transparency, it bridges the gap between buyers and sellers through a robust **Escrow Protection System**, real-time negotiations, and a premium user experience.

---

## ✨ Key Features

### 🛡️ Secure Escrow Protection
Our cornerstone feature. Funds are held safely in the platform's escrow wallet throughout the transaction lifecycle.
- **Buyer Safety**: Money is only released to the seller after the buyer confirms receipt and satisfaction.
- **72-Hour Inspection**: A dedicated window for buyers to verify the product quality before final payout.
- **Admin Mediation**: Integrated dispute resolution system for fair outcomes in case of conflicts.

### 🤝 Dynamic Negotiation Lifecycle
Move beyond static pricing with our interactive offer system.
- **Make Offers**: Buyers can propose prices directly within the chat.
- **Real-time Acceptance**: Sellers can accept or decline offers instantly.
- **Persistent Logic**: Offers are tracked and linked to specific product inventories and transaction records.

### 💬 Real-time Communication
Powered by WebSockets for a seamless, "live" marketplace feel.
- **Instant Messaging**: Low-latency chat between parties.
- **System Notifications**: Real-time alerts for offer updates, payments, and shipping status.
- **Rich Cards**: Visual offer and payment cards rendered directly in the chat stream.

### 💰 Integrated Platform Wallet
A comprehensive financial hub for every user.
- **Secure Deposits**: Mock payment gateway integration for wallet funding.
- **Flexible Withdrawals**: Support for Bank Transfers and Mobile Banking (Bkash/Nagad).
- **Audit-ready History**: Detailed transaction logs for all marketplace activity.

### 📑 Automated Invoicing
Professional documentation for every successful deal.
- **Dynamic PDF Generation**: Automatically generates invoices with order IDs, shipping details, and status badges.
- **Escrow Integration**: Invoices reflect the current stage of the transaction (Paid, Shipped, Delivered).

---

## 🛠️ Technical Stack

| Component | Technology |
| :--- | :--- |
| **Backend** | FastAPI (Python 3.10+) |
| **Database** | PostgreSQL with SQLAlchemy ORM |
| **Real-time** | WebSockets (Native FastAPI implementation) |
| **Authentication** | JWT (Jose) + Bcrypt Hashing |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| **UI Design** | Modern Glassmorphism & Responsive Layouts |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.10+**
- **PostgreSQL** (Running locally or hosted)

### 2. Database Configuration
1. Create a new database:
   ```sql
   CREATE DATABASE resale_db;
   ```
2. Configure your credentials in `backend/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/resale_db
   SECRET_KEY=your_super_secret_key
   ```

### 3. Installation
```bash
# Clone the repository
git clone https://github.com/aonontojahan/Resale-Marketplace-for-Electronics-Devices.git

# Navigate to the project
cd Resale-Marketplace-for-Electronics-Devices

# Install dependencies
pip install -r requirements.txt
```

### 4. Running the Application
```bash
# Start the FastAPI server
uvicorn breloadackend.main:app --
```
- **Frontend**: Open `frontend/index.html` in your modern browser.
- **API Docs**: Explore the interactive documentation at `http://localhost:8000/docs`.

---

## 📂 Project Structure
```text
├── backend/
│   ├── main.py          # API Routes & WebSocket Logic
│   ├── models.py        # SQLAlchemy Database Models
│   ├── schemas.py       # Pydantic Data Validation
│   ├── auth.py          # JWT & Security Utils
│   └── uploads/         # User-uploaded content (Product images, Profile pics)
├── frontend/
│   ├── js/
│   │   ├── app.js       # Core Frontend Logic (200KB+)
│   │   └── api.js       # API Client Wrapper
│   ├── css/
│   │   └── style.css    # Comprehensive Design System
│   ├── index.html       # Landing Page
│   └── chat.html        # Real-time Negotiation Interface
└── requirements.txt     # Python Dependencies
```

---

## 📄 License
This project is licensed under a **Proprietary License**.
Unauthorized copying, redistribution, or commercial use is strictly prohibited. For inquiries, contact the author.

---
Built with ❤️ by **Aononto Jahan Junnurain**.
