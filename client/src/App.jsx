import { useEffect, useState } from "react";
import { getUsers } from "./services/userServices.js";

function App() {

    const [users, setUsers] = useState([]);

    useEffect(() => {

        async function loadUsers() {

            try {

                const data = await getUsers();

                setUsers(data);

            } catch (error) {

                console.log(error);

            }

        }

        loadUsers();

    }, []);

    return (

        <div>

            <h1>Users</h1>

            {

                users.map((user) => (

                    <div key={user.employee_code}>
                        <p>{user.employee_code}</p>
                        <h2>{user.first_name}</h2>
                        <p>{user.email}</p>
                        <p>{user.phone}</p>

                    </div>

                ))

            }

        </div>

    );

}

export default App;
