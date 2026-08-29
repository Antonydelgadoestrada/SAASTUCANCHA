import api from "./axios"


export const getCountByClub = async() =>{
    const result = await api.get("/bookings/getCountByClub");
    return result.data 
}

export const getPopularCourtsByClub = async(range:any) =>{
    const result = await api.post("/bookings/getPopularCourtsByClub", range);
    return result.data 
}
export const getDailyStatsByClub = async(range:any) =>{
    const result = await api.post("/bookings/getDailyStatsByClub", range);
    return result.data 
}
export const getDashboardSummary = async(range:any) =>{
    const result = await api.post("/bookings/getDashboardSummary", range);
    return result.data 
}

export const getBookingsReportByClub = async(range:any) =>{
    const result = await api.post("/bookings/getBookingsReportByClub", range);
    return result.data 
}

export const getHourlyOccupancyDemand = async (params: {
    startDate: string;
    endDate: string;
    sport?: string;
    courtId?: string;
}) => {
    const result = await api.post("/bookings/getHourlyOccupancyDemand", params);
    return result.data;
}

export const getDemandTrendStats = async (params: {
    timeframe?: 'day' | 'week' | 'month';
    date?: string;
    courtId?: string;
    sport?: string;
    startDate?: string;
    endDate?: string;
}) => {
    const result = await api.post("/bookings/getDemandTrendStats", params);
    return result.data;
}