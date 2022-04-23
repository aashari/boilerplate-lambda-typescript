import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";
import { BookingModel } from "../models/booking.model";

export class BookingCreateFunction extends LambdaFunction {

    @statistic(true)
    public async handler(event: any, context: any, callback: any) {
        console.log('BookingCreateFunction.handler()');

        let myBooking = new BookingModel();
        myBooking.id = '12345';
        myBooking.save();

        callback(null, {
            statusCode: 200,
            body: JSON.stringify(myBooking),
        });

    }

}
