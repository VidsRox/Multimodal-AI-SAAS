import {z} from "zod"

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be atleast 8 chars long")
});

export const signupSchema = z.object({
    name: z.string().min(3, "name must be atleast 3 chars long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be atleast 8 chars long"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
    
})

export type LoginSchema = z.infer<typeof loginSchema>
export type SignupSchema = z.infer<typeof signupSchema>