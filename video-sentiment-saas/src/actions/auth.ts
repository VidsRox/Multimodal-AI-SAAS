"use server"

import {hash} from "bcryptjs";
import { error } from "console";
import { signupSchema, type SignupSchema } from "~/schemas/auth";
import { db } from "~/server/db";

export async function RegisterUser(data: SignupSchema) {
    try {
        //server-side validation
        const result = signupSchema.safeParse(data);
        if(!result.success){
            return {error: "Invalid data"};
        }

        const {name, email, password} = data

        //check if user exists
        const existingUser = await db.user.findUnique({
            where: {email}
        })

        if (existingUser){
            return {error: "User already exists"}
        }

        const hashedPassword = await hash(password, 12);

        await db.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            }
        });

        return { success: true}

    } catch (error) {
        return {error: "Something went wrong."}
    }
}