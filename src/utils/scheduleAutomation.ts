import { log } from "console";
import dayjs from "dayjs";
import BusinessModel from "../models/businessModel";
import DayScheduleModel from "../models/dayScheduleModel";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import isoWeek from "dayjs/plugin/isoWeek";
import weekday from "dayjs/plugin/weekday";
import { IAppointmentSchedule } from "../interfaces/appointmentSchedule.interface";
import { IAppointment } from "../interfaces/appointment.interface";
import AppointmentModel from "../models/appointmentModel";

dayjs.extend(weekday);
dayjs.extend(isoWeek);

export const handleScheduleAutomation = async () => {
  // SEARCH ALL BUSINESSES WITH AUTOMATIC SCHEDULE ENABLED

  // buscar por automaticSchedule = true y que scheduleEnd tenga la misma fecha que hoy
  const allBusinesses = await BusinessModel.find({ automaticSchedule: true });

  // forloop: filtrar empresas que deban crear turnos hoy; diferencia entre dayjs().toDate() y scheduleEnd === scheduleAnticipation
  for (let business = 0; business < allBusinesses.length; business++) {
    const businessData = allBusinesses[business];

    const dayDifference = dayjs(businessData.scheduleEnd).diff(
      dayjs().toDate(),
      "day",
      true
    );
    console.log(dayDifference);
    if (dayDifference <= businessData.scheduleAnticipation) {
      // OBTENER TODOS LOS TURNOS PROGRAMADOS
      const allAppointments: IAppointmentSchedule[] =
        await AppointmentScheduleModel.find({
          businessID: businessData._id,
        });

      const newScheduleStartDate = dayjs(businessData.scheduleEnd);

      // POR CADA DIA A CREAR DESDE EL DIA DE RENOVACIÓN DE TURNOS, VERIFICAR QUE TURNOS TIENEN ESE DAYNUMBER Y CREAR TURNOS PARA CADA UNO
      for (let day = 0; day < businessData.scheduleDaysToCreate; day++) {
        // OBTENER DIA Y MES DEL DIA DE TURNOS A CREAR
        const dayToCreateDateObj = dayjs(newScheduleStartDate).add(day, "day");
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
            businessID: businessData._id,
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
    }

    // a scheduleEnd, sumarle scheduleDaysToCreate y actualizar scheduleEnd en businessmodel
    const nextScheduleEnd = dayjs(businessData.scheduleEnd).add(
      businessData.scheduleDaysToCreate,
      "day"
    ).toDate();

    await BusinessModel.findByIdAndUpdate({_id: businessData._id}, {scheduleEnd: nextScheduleEnd})
  }
};