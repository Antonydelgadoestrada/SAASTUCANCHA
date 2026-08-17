export const sportTypes = [
    { value: "futbol_4", label: "Fútbol 4" },
    { value: "futbol_5", label: "Fútbol 5" },
    { value: "futbol_6", label: "Fútbol 6" },
    { value: "futbol_7", label: "Fútbol 7" },
    { value: "futbol_8", label: "Fútbol 8" },
    { value: "futbol_9", label: "Fútbol 9" },
    { value: "futbol_10", label: "Fútbol 10" },
    { value: "futbol_11", label: "Fútbol 11" },
    { value: "voley", label: "Vóley" },
    { value: "tenis", label: "Tenis" },
    { value: "padel", label: "Pádel" },
    { value: "basquet", label: "Básquet" },
]

export const timeSlots: string[] = [];

for (let hour = 7; hour <= 23; hour++) {
  timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
}
