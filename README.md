# ReSale Marketplace

ReSale is a full-stack, secure marketplace for pre-owned high-end electronics in Bangladesh. It features a robust **FastAPI** backend and a **PostgreSQL** database, ensuring 100% security through an integrated **Escrow Protection System**.

## 🛠 Features
- **Role-Based Authentication**: Separate experiences for **Admin**, **Seller**, and **Buyer**.
- **Secure Escrow**: Funds are held safely until the transaction is confirmed.
- **Real-time Messaging**: Direct communication between buyers and sellers.
- **Modern UI**: Vibrant, responsive design with glassmorphism and smooth animations.

## 🚀 Getting Started

### 1. Database Configuration
1. Install **PostgreSQL** on your machine.
2. Open your SQL Shell (psql) and run: `CREATE DATABASE resale_db;`.
3. Your database credentials are saved in `backend/.env`.

### 2. Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server

uvicorn backend.main:app --reload

### 3. Accessing the Application:
- **Frontend**: Open `frontend/index.html` in your browser.
- **API Documentation**: Visit `http://localhost:8000/docs`.

---
Built by Aononto Jahan Junnurain. 

## 📄 License
This project is licensed under a **Proprietary License** - Unauthorized copying, redistribution, or commercial use is strictly prohibited. See the [LICENSE](file:///e:/PROJECTS/Resale-Marketplace-for-Electronics-Devices/LICENSE) file for details.
