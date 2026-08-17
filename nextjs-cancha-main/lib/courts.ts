import api from "./axios"

export const getAllCourts = async() =>{
    const result = await api.get("/courts");
    return result.data 
}
export const getAllCourtsByQuery = async(query:string) =>{
    const result = await api.get(`/courts/query?${query}`);
    return result.data 
}
export const getAllCourtsByVenues = async() =>{
    const result = await api.get("/courts/club");
    return result.data 
}

export const getLimit10 = async() =>{
    const result = await api.get("/courts/featured");
    return result.data 
}

export const createCourts = async(data:any)=>{
    if(data.venueId){delete data.venueId}
    //todo: create formdata
    const formData = createFormData(data)
    const result = await api.post("/courts", formData , 
    {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return result.data 
}
const createFormData= (data:any)=>{
    const formData = new FormData()

    for (const key in data) {
      if (key === 'id') continue
  
      if (key === 'selectedFiles' && Array.isArray(data.selectedFiles)) {
          data.selectedFiles.forEach((img: File) => {
          formData.append('images', img)
        })
      } 
      else if (key === 'venue' && typeof data.venue === 'object') {
        formData.append('venue', JSON.stringify(data.venue))
      } 
      else if (key =='existingImages') {
        formData.append('existingImages', JSON.stringify(data.existingImages))
      } 
      else if(data[key]) {
        formData.append(key, data[key])
      }
    }
    return formData
}
export const editCourts = async (data:any)=>{
    if(data.venueId){delete data.venueId}
    const formData = createFormData(data)
    const result = await api.put(`/courts/${data.id}`, formData,
    {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return result.data 
}
export const deleteCourts = async (id:any)=>{
    const result = await api.delete(`/courts/${id}`
    );
    return result.data 
}


