import api from "./axios"


export const createReservationManual = async(data:any)=>{
    const dataForm = createFormData(data)
    const result = await api.post("/bookings/manual", dataForm,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      }
    }
    );
    return result.data 
}

export const paymemtManual = async(data:any)=>{
  const result = await api.post("/bookings/online/payment", data);
  return result.data 
}

export const cancelBooking = async(data:any)=>{
  const result = await api.post("/bookings/online/cancel", data);
  return result.data 
}

export const getAllReservation = async ()=>{
    const result = await api.get(`/bookings/club`);
    return result.data 
}

export const getAllReservationByUser = async ()=>{
    const result = await api.get(`/bookings/user`);
    return result.data 
}

const createFormData= (data:any)=>{
    const formData = new FormData()

    for (const key in data) {
      if (key === 'id') continue
  
      if (key === 'image') {
        formData.append('image', data.image)
      } 
      else if (key =='pricing') {
        formData.append('pricing', JSON.stringify(data.pricing))
      } 
      else if(data[key]) {
        formData.append(key, data[key])
      }
    }
    return formData
}


