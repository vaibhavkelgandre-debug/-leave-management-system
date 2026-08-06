import * as holidayService from "../services/holidayService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function createHoliday(req, res, next) {
    try {
        const holiday = await holidayService.createHoliday(req.body);
        sendSuccess(res, 201, "Holiday created", holiday);
    } catch (error) {
        next(error);
    }
}

export async function getHolidays(req, res, next) {
    try {
        const holidays = await holidayService.listHolidays(req.query.year);
        sendSuccess(res, 200, "Holidays retrieved", holidays);
    } catch (error) {
        next(error);
    }
}

export async function updateHoliday(req, res, next) {
    try {
        const holiday = await holidayService.updateHoliday(req.params.id, req.body);
        sendSuccess(res, 200, "Holiday updated", holiday);
    } catch (error) {
        next(error);
    }
}

export async function deleteHoliday(req, res, next) {
    try {
        await holidayService.deleteHoliday(req.params.id);
        sendSuccess(res, 200, "Holiday deleted", null);
    } catch (error) {
        next(error);
    }
}
