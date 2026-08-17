// import api from "./axios"

// export const authorizationMercadopago = async(clubId:string) =>{
//     const result = await api.get(`/payments/authorize?clubId=${clubId}`);
//     return result.data 
// }

// export const createClubs = async(data:any)=>{
//     if(data.venueId){delete data.venueId}
//     const result = await api.post("/payments", data);
//     return result.data 
// }

// export const editClubs = async (data:any)=>{
//     if(data.venueId){delete data.venueId}
//     const result = await api.put(`/payments/${data.id}`, data);
//     return result.data 
// }

// export const approveClub = async (id:string)=>{
//     const result = await api.patch(`/payments/approve/${id}`);
//     return result.data 
// }
// export const rejectClub = async (id:string)=>{
//     const result = await api.patch(`/payments/reject/${id}`);
//     return result.data 
// }