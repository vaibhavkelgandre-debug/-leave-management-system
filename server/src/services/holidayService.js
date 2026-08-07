import {
    insertHoliday,
    findAllHolidays,
    findHolidayById,
    findOverlappingHoliday,
    updateHoliday as updateHolidayRepo,
    deleteHoliday as deleteHolidayRepo,
} from "../repositories/holidayRepository.js";
import { conflict, notFound } from "../utils/appError.js";

export async function createHoliday({ name, startDate, endDate }) {
    const resolvedEndDate = endDate || startDate;

    if (await findOverlappingHoliday({ startDate, endDate: resolvedEndDate })) {
        throw conflict("A holiday already covers one or more of these dates");
    }

    return insertHoliday({ name, startDate, endDate: resolvedEndDate });
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

export async function updateHoliday(id, { name, startDate, endDate }) {
    await getHolidayById(id);
    const resolvedEndDate = endDate || startDate;

    if (await findOverlappingHoliday({ startDate, endDate: resolvedEndDate, excludeId: id })) {
        throw conflict("A holiday already covers one or more of these dates");
    }

    const updated = await updateHolidayRepo(id, { name, startDate, endDate: resolvedEndDate });
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
