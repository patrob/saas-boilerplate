export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            SaaS Boilerplate
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            A modern B2C SaaS boilerplate with multi-tenant architecture
          </p>
          <div className="mt-8">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

