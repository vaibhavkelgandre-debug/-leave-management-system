import axios from "axios";

const API = axios.create({
    baseURL: "http://localhost:5001/api",
});

export async function getUsers() {

    const response = await API.get("/users");

    return response.data;

}