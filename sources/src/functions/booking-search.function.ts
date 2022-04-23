import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";
import { BookingModel } from "../models/booking.model";

export class BookingSearchFunction extends LambdaFunction {

    @statistic()
    public async handler(event: any, context: any, callback: any) {
        
        console.log('BookingSearchFunction.handler()');
        let bookingList = await BookingModel.scan();

        callback(null, {
            statusCode: 200,
            body: JSON.stringify(bookingList),
        });
        
    }

}
