import dayjs from "dayjs";
import { IAppointmentSchedule } from "../interfaces/appointmentSchedule.interface";
import { IBusiness } from "../interfaces/business.interface";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import { IAppointment } from "../interfaces/appointment.interface";
import AppointmentModel from "../models/appointmentModel";

export const generateAppointments = async (businessData: IBusiness) => {
  console.log(businessData);

  // OBTENER TODOS LOS TURNOS PROGRAMADOS
  const allAppointments: IAppointmentSchedule[] =
    await AppointmentScheduleModel.find({
      businessID: businessData._id,
    });
  // POR CADA DIA A CREAR DESDE EL DIA DE hHOY, VERIFICAR QUE TURNOS TIENEN ESE DAYNUMBER Y CREAR TURNOS PARA CADA UNO
  for (let day = 0; day < businessData.scheduleDaysToCreate + 1; day++) {
    // OBTENER DIA Y MES DEL DIA DE TURNOS A CREAR
    const dayToCreateDateObj = dayjs().add(day, "day");
    const dayToCreateNumber = Number(dayjs(dayToCreateDateObj).format("d"));
    const dayToCreateDate = dayToCreateDateObj.format("MM/DD/YYYY"); // 30/08/2024

    // OBTENER LOS TURNOS A CREAR CON LA FECHA
    const appointmentsToCreate = allAppointments.filter(
      (appointment) => appointment.dayNumber === dayToCreateNumber
    );

    // CREAR CADA TURNO DEL DIA
    appointmentsToCreate.forEach(async (appointment) => {
      // FORMATEAR FECHA PARA CREAR CADA TURNO
      const startTime = dayjs(appointment.start).format("HH:mm");
      const endTime = dayjs(appointment.end).format("HH:mm");
      const startDateString = `${dayToCreateDate} ${startTime}`;
      const endDateString = `${dayToCreateDate} ${endTime}`;
      const startDate = dayjs(startDateString).toDate();
      const endDate = dayjs(endDateString).toDate();

      // OBJETO DE TURNO A CREAR
      const appointmentObj: IAppointment = {
        businessID: businessData._id!,
        clientID: "",
        description: appointment.description,
        email: "",
        end: endDate,
        start: startDate,
        service: appointment.service,
        price: appointment.price,
        title: "Disponible",
        phone: 0,
        name: "",
        status: "unbooked",
      };
      // ALMACENAR TURNO EN APPOINTMENTS
      await AppointmentModel.create(appointmentObj);
    });
  }
};
