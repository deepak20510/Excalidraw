"use client";
export function AuthPage({ isSignin }: { isSignin: boolean }) {
  return (
    <div className="w-screen h-screen justify-center items-center">
      <div className="p-2 m-2 bg-white rounded">
        <input type="text" placeholder="Email" />
        <input placeholder="Password" type="password" />
        <button onClick={() => {}}>{isSignin ? "Sign in" : "Sign up"}</button>
      </div>
    </div>
  );
}
