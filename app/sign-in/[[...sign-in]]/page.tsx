import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary: {
                fontSize: "14px",
                textTransform: "none",
                backgroundColor: "#611BBD",
                "&:hover, &:focus, &:active": {
                  backgroundColor: "#49247A",
                },
              },
            },
          }}
        />
    </div>
  );
}
