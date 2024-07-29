import express from "express";
import connectDB from "./config/db";
import cors from "cors";
import userRoutes from "./routes/userRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import businessRoutes from "./routes/businessRoutes";
import cookieParser from "cookie-parser";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import { handlePlanExpiracy } from "./utils/planExpiracy";
import cron from "node-cron";
import { Request } from "express";

// SERVER INICIALIZATION
const app = express();
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// MONGODB CONNECTION
connectDB().then(() => {
  console.log(`DB connected`);
});

// SCHEDULED SUBSCRIPTION EXPIRACY HANDLER
cron.schedule(" 40 17 * * * ", () => {
  handlePlanExpiracy();
});

// CORS SETTINGS
app.use(
  cors<Request>({
    origin: ["https://sacaturno.com.ar", "https://www.sacaturno.com.ar", "http://localhost:3000"],
    credentials: true,
  })
);

// ROUTES
app.use(cookieParser());
app.use(express.json());
app.use("/api", userRoutes);
app.use("/api", appointmentRoutes);
app.use("/api", businessRoutes);
app.use("/api", subscriptionRoutes);
