import express, { Request, Response } from 'express';
import connectDB from './config/db';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import businessRoutes from './routes/businessRoutes';
import cookieParser from 'cookie-parser'
import subscriptionRoutes from './routes/subscriptionRoutes';

const app = express();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


/* MONGODB CONNECTION */
connectDB().then(() => {
    console.log(`DB connected`)
})

app.use(cookieParser())
app.use(cors())
app.use(express.json())
app.use('/api', userRoutes)
app.use('/api', appointmentRoutes)
app.use('/api', businessRoutes)
app.use('/api', subscriptionRoutes)
