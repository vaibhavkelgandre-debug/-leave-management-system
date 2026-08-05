import { getUsers } from "../repositories/userRepository.js";

export async function fetchUsers() {

    return await getUsers();

}