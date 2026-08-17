import api from "./axios"

export const getAllUser = async() =>{
    const result = await api.get("/users/club");
    return result.data 
}


export const editUser = async (data:any)=>{
    if(data.venueId){delete data.venueId}
    const result = await api.put(`/users/${data.id}`, data);
    return result.data 
}

export const getAdminDashboardStats = async () => {
    const result = await api.get("/users/admin/dashboard-stats");
    return result.data;
}
