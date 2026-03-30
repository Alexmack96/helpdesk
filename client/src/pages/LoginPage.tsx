import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn, useSession } from "../lib/authClient.js";

const schema = z.object({
  email: z.email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(schema) });

  if (session) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  async function onSubmit(values: LoginFormValues) {
    const { error } = await signIn.email(values);
    if (error) {
      setError("root.serverError", { message: "Invalid email or password" });
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Sign in</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.email ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
            />
            {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              {...register("password")}
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.password ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
            />
            {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
          </div>
          {errors.root?.serverError && <p className="text-sm text-red-600">{errors.root.serverError.message}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
