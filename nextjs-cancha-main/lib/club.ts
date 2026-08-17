import api from "./axios"

export const getAllClubs = async() =>{
    const result = await api.get("/clubs");
    return result.data 
}

export const createClubs = async(data:any)=>{
    if(data.venueId){delete data.venueId}
    const result = await api.post("/clubs", data);
    return result.data 
}

export const editClubs = async (data:any)=>{
    if(data.venueId){delete data.venueId}
    const result = await api.put(`/clubs/${data.id}`, data);
    return result.data 
}

export const approveClub = async (id:string)=>{
    const result = await api.patch(`/clubs/approve/${id}`);
    return result.data 
}
export const rejectClub = async (id:string)=>{
    const result = await api.patch(`/clubs/reject/${id}`);
    return result.data 
}