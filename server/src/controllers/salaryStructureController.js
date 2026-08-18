import * as salaryStructureService from "../services/salaryStructureService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getStructure(req, res, next) {
    try {
        const structure = await salaryStructureService.getStructure(req.user, req.params.id);
        sendSuccess(res, 200, "Salary structure retrieved", structure);
    } catch (error) {
        next(error);
    }
}

export async function assignStructure(req, res, next) {
    try {
        const structure = await salaryStructureService.assignStructure(req.user, req.params.id, req.body);
        sendSuccess(res, 200, "Salary structure saved", structure);
    } catch (error) {
        next(error);
    }
}
