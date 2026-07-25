import dayjs from "dayjs";
import { Request } from "express";
import UserModel from "../models/userModel";
import BusinessModel from "../models/businessModel";
import AppointmentModel from "../models/appointmentModel";
import ServiceModel from "../models/serviceModel";
import SubscriptionModel from "../models/subscriptionModel";
import PlanPaymentModel from "../models/planPaymentModel";
import EmployeeModel from "../models/employeeModel";
import BranchModel from "../models/branchModel";

const DEFAULT_ACTIVITY_WINDOW_DAYS = 30;

// A business is "active" if it had any appointment activity (booked or
// unbooked slots created) in the window — creating slots is itself a sign
// the owner is using the scheduling feature, not just receiving bookings.
const getActiveBusinessIds = async (windowDays = DEFAULT_ACTIVITY_WINDOW_DAYS) => {
  const cutoff = dayjs().subtract(windowDays, "day").toDate();
  return AppointmentModel.distinct("businessID", { createdAt: { $gte: cutoff } });
};

const SGetOverview = async (req: Request) => {
  const windowDays = Number(req.query.windowDays) || DEFAULT_ACTIVITY_WINDOW_DAYS;

  const [
    totalUsers,
    totalBusinesses,
    activeBusinessIds,
    paidSubscriptions,
    totalRevenueAgg,
    monthRevenueAgg,
    mpLinkedCount,
  ] = await Promise.all([
    UserModel.countDocuments(),
    BusinessModel.countDocuments(),
    getActiveBusinessIds(windowDays),
    SubscriptionModel.countDocuments({ subscriptionType: { $in: ["SC_BASIC", "SC_PRO", "SC_FULL"] } }),
    PlanPaymentModel.aggregate([{ $group: { _id: null, total: { $sum: "$price" } } }]),
    PlanPaymentModel.aggregate([
      { $match: { createdAt: { $gte: dayjs().startOf("month").toDate() } } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
    BusinessModel.countDocuments({ mpLinked: true }),
  ]);

  const activeBusinessOwnerIds = await BusinessModel.distinct("ownerID", {
    _id: { $in: activeBusinessIds },
  });

  return {
    windowDays,
    totalUsers,
    totalBusinesses,
    activeBusinesses: activeBusinessIds.length,
    activeUsers: activeBusinessOwnerIds.length,
    paidSubscriptions,
    freeSubscriptions: totalBusinesses - paidSubscriptions,
    conversionRate: totalBusinesses > 0 ? paidSubscriptions / totalBusinesses : 0,
    totalRevenue: totalRevenueAgg[0]?.total || 0,
    monthRevenue: monthRevenueAgg[0]?.total || 0,
    mpLinkedBusinesses: mpLinkedCount,
    mpAdoptionRate: totalBusinesses > 0 ? mpLinkedCount / totalBusinesses : 0,
  };
};

const SGetGrowth = async (req: Request) => {
  const months = Math.min(Number(req.query.months) || 12, 36);
  const startMonth = dayjs().subtract(months - 1, "month").startOf("month");

  const [users, businesses, appointments] = await Promise.all([
    UserModel.find({ createdAt: { $gte: startMonth.toDate() } }).select("createdAt").lean(),
    BusinessModel.find({ createdAt: { $gte: startMonth.toDate() } }).select("createdAt").lean(),
    AppointmentModel.find({ createdAt: { $gte: startMonth.toDate() } }).select("createdAt status").lean(),
  ]);

  const buckets = new Map<string, { newUsers: number; newBusinesses: number; appointments: number; bookedAppointments: number }>();
  for (let i = 0; i < months; i++) {
    buckets.set(startMonth.add(i, "month").format("YYYY-MM"), { newUsers: 0, newBusinesses: 0, appointments: 0, bookedAppointments: 0 });
  }

  const bump = (date: Date, fn: (b: { newUsers: number; newBusinesses: number; appointments: number; bookedAppointments: number }) => void) => {
    const key = dayjs(date).format("YYYY-MM");
    const bucket = buckets.get(key);
    if (bucket) fn(bucket);
  };

  users.forEach((u) => bump((u as any).createdAt, (b) => b.newUsers++));
  businesses.forEach((b) => bump((b as any).createdAt, (bucket) => bucket.newBusinesses++));
  appointments.forEach((a) =>
    bump((a as any).createdAt, (bucket) => {
      bucket.appointments++;
      if (a.status === "booked") bucket.bookedAppointments++;
    })
  );

  return Array.from(buckets.entries()).map(([month, data]) => ({
    month,
    label: dayjs(month + "-01").format("MMM YYYY"),
    ...data,
  }));
};

const SGetRevenue = async (req: Request) => {
  const months = Math.min(Number(req.query.months) || 12, 36);
  const startMonth = dayjs().subtract(months - 1, "month").startOf("month");

  const payments = await PlanPaymentModel.find({ createdAt: { $gte: startMonth.toDate() } })
    .select("createdAt price subscriptionType")
    .lean();

  const buckets = new Map<string, { revenue: number; payments: number }>();
  for (let i = 0; i < months; i++) {
    buckets.set(startMonth.add(i, "month").format("YYYY-MM"), { revenue: 0, payments: 0 });
  }

  const byPlan = new Map<string, number>();

  payments.forEach((p) => {
    const key = dayjs((p as any).createdAt).format("YYYY-MM");
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += p.price || 0;
      bucket.payments++;
    }
    byPlan.set(p.subscriptionType, (byPlan.get(p.subscriptionType) || 0) + (p.price || 0));
  });

  return {
    monthly: Array.from(buckets.entries()).map(([month, data]) => ({
      month,
      label: dayjs(month + "-01").format("MMM YYYY"),
      ...data,
    })),
    byPlan: Array.from(byPlan.entries()).map(([subscriptionType, revenue]) => ({ subscriptionType, revenue })),
  };
};

const SGetFunnel = async (req: Request) => {
  const windowDays = Number(req.query.windowDays) || DEFAULT_ACTIVITY_WINDOW_DAYS;

  const [
    totalUsers,
    unverifiedUsers,
    ownerIds,
    totalBusinesses,
    businessIdsWithAppointments,
    freeSubscriptions,
    activeBusinessIds,
  ] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ verified: false }),
    BusinessModel.distinct("ownerID"),
    BusinessModel.countDocuments(),
    AppointmentModel.distinct("businessID"),
    SubscriptionModel.find({ subscriptionType: "SC_FREE" }).select("businessID").lean(),
    getActiveBusinessIds(windowDays),
  ]);

  const usersWithoutBusiness = totalUsers - ownerIds.length;
  const businessesWithoutAppointments = totalBusinesses - businessIdsWithAppointments.length;

  const activeSet = new Set(activeBusinessIds);
  const freeAndAbandoned = freeSubscriptions.filter((s) => !activeSet.has(s.businessID as string)).length;

  const steps = [
    { label: "Usuarios registrados", count: totalUsers },
    { label: "Usuarios sin verificar", count: unverifiedUsers },
    { label: "Usuarios sin negocio creado", count: usersWithoutBusiness },
    { label: "Negocios sin turnos creados", count: businessesWithoutAppointments },
    { label: "Negocios free inactivos", count: freeAndAbandoned },
  ];

  return steps.map((s) => ({
    ...s,
    percentOfTotal: totalUsers > 0 ? s.count / totalUsers : 0,
  }));
};

const SGetTopBusinesses = async (windowDays = DEFAULT_ACTIVITY_WINDOW_DAYS, limit = 10) => {
  const cutoff = dayjs().subtract(windowDays, "day").toDate();
  const results = await AppointmentModel.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    { $group: { _id: "$businessID", appointments: { $sum: 1 } } },
    { $sort: { appointments: -1 } },
    { $limit: limit },
  ]);

  const businesses = await BusinessModel.find({ _id: { $in: results.map((r) => r._id) } })
    .select("name slug businessType")
    .lean();
  const businessMap = new Map(businesses.map((b) => [String(b._id), b]));

  return results.map((r) => ({
    businessID: r._id,
    appointments: r.appointments,
    business: businessMap.get(r._id) || null,
  }));
};

const SGetFeatureAdoption = async () => {
  const [totalBusinesses, totalServices, servicesWithDeposit, businessesWithEmployees, businessesWithBranches, byType] =
    await Promise.all([
      BusinessModel.countDocuments(),
      ServiceModel.countDocuments(),
      ServiceModel.countDocuments({ depositAmount: { $gt: 0 } }),
      EmployeeModel.distinct("businessID"),
      BranchModel.distinct("businessID"),
      BusinessModel.aggregate([{ $group: { _id: "$businessType", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);

  return {
    depositAdoption: totalServices > 0 ? servicesWithDeposit / totalServices : 0,
    servicesWithDeposit,
    totalServices,
    businessesUsingEmployees: businessesWithEmployees.length,
    businessesUsingBranches: businessesWithBranches.length,
    totalBusinesses,
    byBusinessType: byType.map((t) => ({ businessType: t._id || "Sin categoría", count: t.count })),
  };
};

const SGetExpiringSubscriptions = async () => {
  const now = dayjs();
  const subs = await SubscriptionModel.find({
    expiracyDate: { $gte: now.toDate(), $lte: now.add(7, "day").toDate() },
    subscriptionType: { $ne: "SC_FREE" },
  })
    .sort({ expiracyDate: 1 })
    .lean();

  const businesses = await BusinessModel.find({ _id: { $in: subs.map((s) => s.businessID) } })
    .select("name email phone slug")
    .lean();
  const businessMap = new Map(businesses.map((b) => [String(b._id), b]));

  return subs.map((s) => ({
    businessID: s.businessID,
    expiracyDate: s.expiracyDate,
    subscriptionType: s.subscriptionType,
    business: businessMap.get(s.businessID as string) || null,
  }));
};

const SGetBusinesses = async (req: Request) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = 20;
  const search = String(req.query.search || "").trim();

  const filter = search
    ? { name: { $regex: search, $options: "i" } }
    : {};

  const [total, businesses] = await Promise.all([
    BusinessModel.countDocuments(filter),
    BusinessModel.find(filter)
      .select("name slug businessType email phone createdAt mpLinked")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const businessIds = businesses.map((b) => String(b._id));
  const [subscriptions, appointmentCounts, lastAppointments, activeBusinessIds, employeeCounts, branchCounts] = await Promise.all([
    SubscriptionModel.find({ businessID: { $in: businessIds } }).lean(),
    AppointmentModel.aggregate([{ $match: { businessID: { $in: businessIds } } }, { $group: { _id: "$businessID", count: { $sum: 1 } } }]),
    AppointmentModel.aggregate([
      { $match: { businessID: { $in: businessIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$businessID", lastActivity: { $first: "$createdAt" } } },
    ]),
    getActiveBusinessIds(),
    EmployeeModel.aggregate([{ $match: { businessID: { $in: businessIds } } }, { $group: { _id: "$businessID", count: { $sum: 1 } } }]),
    BranchModel.aggregate([{ $match: { businessID: { $in: businessIds } } }, { $group: { _id: "$businessID", count: { $sum: 1 } } }]),
  ]);

  const subMap = new Map(subscriptions.map((s) => [s.businessID, s]));
  const apptCountMap = new Map(appointmentCounts.map((a) => [a._id, a.count]));
  const lastApptMap = new Map(lastAppointments.map((a) => [a._id, a.lastActivity]));
  const activeSet = new Set(activeBusinessIds);
  const employeeCountMap = new Map(employeeCounts.map((e) => [e._id, e.count]));
  const branchCountMap = new Map(branchCounts.map((b) => [b._id, b.count]));

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    businesses: businesses.map((b) => {
      const id = String(b._id);
      return {
        ...b,
        subscription: subMap.get(id) || null,
        appointmentsCount: apptCountMap.get(id) || 0,
        lastActivity: lastApptMap.get(id) || null,
        isActive: activeSet.has(id),
        employeeCount: employeeCountMap.get(id) || 0,
        branchCount: branchCountMap.get(id) || 0,
      };
    }),
  };
};

const buildUserSummary = async (userId: string) => {
  const [ownedBusinesses, memberships] = await Promise.all([
    BusinessModel.find({ ownerID: userId }).select("name slug businessType createdAt mpLinked").lean(),
    EmployeeModel.find({ userID: userId }).select("businessID status permissions").lean(),
  ]);

  const ownedBusinessIds = ownedBusinesses.map((b) => String(b._id));
  const memberBusinessIds = memberships.map((m) => m.businessID);
  const relevantBusinessIds = Array.from(new Set([...ownedBusinessIds, ...memberBusinessIds]));

  const [appointmentCounts, lastAppointments, subscriptions, payments, memberBusinesses, activeBusinessIds] = await Promise.all([
    AppointmentModel.aggregate([{ $match: { businessID: { $in: relevantBusinessIds } } }, { $group: { _id: "$businessID", count: { $sum: 1 } } }]),
    AppointmentModel.aggregate([
      { $match: { businessID: { $in: relevantBusinessIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$businessID", lastActivity: { $first: "$createdAt" } } },
    ]),
    SubscriptionModel.find({ businessID: { $in: relevantBusinessIds } }).lean(),
    PlanPaymentModel.find({ businessID: { $in: ownedBusinessIds } }).sort({ createdAt: -1 }).lean(),
    BusinessModel.find({ _id: { $in: memberBusinessIds } }).select("name slug businessType").lean(),
    getActiveBusinessIds(),
  ]);

  const apptCountMap = new Map(appointmentCounts.map((a) => [a._id, a.count]));
  const lastApptMap = new Map(lastAppointments.map((a) => [a._id, a.lastActivity]));
  const subMap = new Map(subscriptions.map((s) => [s.businessID, s]));
  const memberBusinessMap = new Map(memberBusinesses.map((b) => [String(b._id), b]));
  const activeSet = new Set(activeBusinessIds);

  return {
    ownedBusinesses: ownedBusinesses.map((b) => {
      const id = String(b._id);
      return {
        ...b,
        subscription: subMap.get(id) || null,
        appointmentsCount: apptCountMap.get(id) || 0,
        lastActivity: lastApptMap.get(id) || null,
        isActive: activeSet.has(id),
      };
    }),
    memberships: memberships.map((m) => ({
      ...m,
      business: memberBusinessMap.get(m.businessID) || null,
      appointmentsCount: apptCountMap.get(m.businessID) || 0,
      isActive: activeSet.has(m.businessID),
    })),
    subscriptionPayments: payments,
  };
};

const SGetUsers = async (req: Request) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = 20;
  const search = String(req.query.search || "").trim();

  const filter = search
    ? { $or: [{ name: { $regex: search, $options: "i" } }, { surname: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
    : {};

  const [total, users] = await Promise.all([
    UserModel.countDocuments(filter),
    UserModel.find(filter)
      .select("name surname email phone verified createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const rows = await Promise.all(
    users.map(async (u) => {
      const userId = String(u._id);
      const summary = await buildUserSummary(userId);
      const role = summary.ownedBusinesses.length > 0 ? "owner" : summary.memberships.length > 0 ? "employee" : "none";
      const isActive = summary.ownedBusinesses.some((b) => b.isActive) || summary.memberships.some((m) => m.isActive);
      return {
        ...u,
        role,
        isActive,
        businesses: summary.ownedBusinesses.map((b) => ({ name: b.name, businessID: String((b as any)._id) })),
        memberBusinesses: summary.memberships.map((m) => m.business?.name).filter(Boolean),
        totalSubscriptionPayments: summary.subscriptionPayments.reduce((s, p) => s + (p.price || 0), 0),
      };
    })
  );

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    users: rows,
  };
};

const SGetUserDetail = async (req: Request) => {
  const { userId } = req.params;
  const user = await UserModel.findById(userId).select("name surname email phone verified isFirstLogin createdAt").lean();
  if (!user) return null;

  const summary = await buildUserSummary(userId);

  return { user, ...summary };
};

export {
  SGetOverview,
  SGetGrowth,
  SGetRevenue,
  SGetFunnel,
  SGetTopBusinesses,
  SGetFeatureAdoption,
  SGetExpiringSubscriptions,
  SGetBusinesses,
  SGetUsers,
  SGetUserDetail,
};
