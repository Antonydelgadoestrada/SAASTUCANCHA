import api from "./axios"

const getUser = ()=>{
    const user = localStorage.getItem('user')
    return user?JSON.parse(user):{}
}

export const getAllVenues = async() =>{
    const result = await api.get("/venues/club");
    return result.data 

}

export const create = async(data:any)=>{
    const {clubId} = getUser()
    const result = await api.post("/venues", Object.assign(data, {clubId}));
    return result.data 
}

export const edit = async (data:any)=>{
    const result = await api.put(`/venues/${data.id}`, data);
    return result.data 
}
export const deleteVenue = async (id:number)=>{
    const result = await api.delete(`/venues/${id}`);
    return result.data 
}
  