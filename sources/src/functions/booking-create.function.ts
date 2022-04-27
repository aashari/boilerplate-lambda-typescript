import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";
import { BookingModel } from "../models/booking.model";

export class BookingCreateFunction extends LambdaFunction {

    @statistic()
    public async handler(event: any, context: any, callback: any) {
        console.log('BookingCreateFunction.handler()');

        let myBookingList: BookingModel[] = []

        for (let i = 0; i < 100; i++) {
            let myBooking = new BookingModel();
            myBooking.id = i.toString();
            myBooking.save();
            myBookingList.push(myBooking);
        }

        callback(null, {
            statusCode: 200,
            body: JSON.stringify(myBookingList),
        });

    }

}
