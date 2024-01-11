function Attendance(props: {liveAttendance: number, maxAttendance: number}) {
    return(
        <div class="flex flex-row p-8 w-full">
            <p class="capitalize font-bold text-8xl text-black">
                present - {props.liveAttendance.toLocaleString('en-US',{
                    minimumIntegerDigits: 2,
                    useGrouping: false
            })}
            </p>
            <p class="font-bold text-6xl text-gray-300 flex flex-col-reverse pb-2">/{props.maxAttendance.toLocaleString('en-US',{
                minimumIntegerDigits: 2,
                useGrouping: false
            })}</p>
        </div>
    );
}

export default Attendance;