import {
    insertHoliday,
    findAllHolidays,
    findHolidayById,
    updateHoliday as updateHolidayRepo,
    deleteHoliday as deleteHolidayRepo,
} from "../repositories/holidayRepository.js";
import { notFound } from "../utils/appError.js";

export async function createHoliday(payload) {
    return insertHoliday(payload);
}

export async function listHolidays(year) {
    return findAllHolidays({ year });
}

export async function getHolidayById(id) {
    const holiday = await findHolidayById(id);
    if (!holiday) {
        throw notFound("Holiday not found");
    }
    return holiday;
}

export async function updateHoliday(id, payload) {
    await getHolidayById(id);
    const updated = await updateHolidayRepo(id, payload);
    if (!updated) {
        throw notFound("Holiday not found");
    }
    return updated;
}

export async function deleteHoliday(id) {
    const deleted = await deleteHolidayRepo(id);
    if (!deleted) {
        throw notFound("Holiday not found");
    }
}
