\# RABS-POC: Technology Stack \& Setup Guide



\## 1. Introduction to the Proof-of-Concept (POC)



\*\*R.A.B.S. (Real-time Adaptive Backend System)\*\* is a next-generation scheduling and resource coordination platform. This repository, `rabs-poc`, is a \*\*local-only sandbox\*\* created to test the feasibility and core logic of the future RABS system. It is not intended for production use.



The primary goals of this POC are to prove that the system can:



\*   Add and remove clients from scheduled activities.

\*   Dynamically adjust staffing, billing, and vehicle assignments in response to changes.

\*   Provide a robust API that could be used by other services, such as a voice agent.



\### What This POC Is Not:

\*   ❌ Not secure

\*   ❌ Not online by default

\*   ❌ Not production-ready

\*   ❌ Not privacy-compliant



> ⚠️ \*\*Reminder:\*\* The real R.A.B.S. system will be built in a separate repository using production-grade architecture and security.



\## 2. Technology Stack



\*   \*\*Backend:\*\* Node.js + Express

\*   \*\*Frontend:\*\* React (built with Vite)

\*   \*\*Database:\*\* SQLite (swap-friendly for prototyping)

\*   \*\*Authentication:\*\* Hardcoded development session for simulating API use. No real login flows are required for the POC.



\## 3. Project Structure



rabs-poc/

├── backend/

│ ├── routes/

│ ├── models/

│ ├── services/ // (Previously named logic/)

│ └── server.js

├── frontend/

│ ├── src/

│ └── public/

├── data/

│ └── rabs-poc.db (Generated on first run)

├── docs/

│ └── (All project documentation)

├── scripts/

│ └── seed.js

├── .env.example

└── README.md





\## 4. Getting Started



\### Prerequisites

\*   Node.js (version 16 or higher)

\*   npm (usually comes with Node.js)



\### Installation

1\.  Clone the repository:

&nbsp;   ```bash

&nbsp;   git clone https://github.com/YOUR-USERNAME/rabs-poc.git

&nbsp;   cd rabs-poc

&nbsp;   ```

2\.  Install dependencies for both backend and frontend:

&nbsp;   ```bash

&nbsp;   # Install backend dependencies

&nbsp;   cd backend

&nbsp;   npm install

&nbsp;   cd ..



&nbsp;   # Install frontend dependencies

&nbsp;   cd frontend

&nbsp;   npm install

&nbsp;   cd ..

&nbsp;   ```



\### Configuration

1\.  In the project root, create a `.env` file by copying the example:

&nbsp;   ```bash

&nbsp;   cp .env.example .env

&nbsp;   ```

2\.  Edit the `.env` file and fill in the required variables, such as `PORT` and `API\_PORT`.



\### Running the Application

1\.  \*\*Start the Backend Server:\*\*

&nbsp;   ```bash

&nbsp;   cd backend

&nbsp;   npm start

&nbsp;   ```

2\.  \*\*Start the Frontend Development Server:\*\*

&nbsp;   Open a new terminal window.

&nbsp;   ```bash

&nbsp;   cd frontend

&nbsp;   npm start

&nbsp;   ```

3\.  \*\*Seed the Database:\*\*

&nbsp;   Open a third terminal window. This only needs to be done once on the first run.

&nbsp;   ```bash

&nbsp;   cd backend

&nbsp;   npm run seed

&nbsp;   ```



You should now be able to access the React frontend in your browser at the address provided by Vite (e.g., `http://localhost:5173`).



\## 5. Mock Data

The `seed.js` script populates the database with a set of mock data to make the POC functional out-of-the-box:

\*   10 clients (fake participant profiles)

\*   5 staff members

\*   2 centers

\*   4 vehicles

\*   A sample activity schedule with time slots and metadata

\*   A fake billing engine

\*   Fake HR logic for timesheet calculation

