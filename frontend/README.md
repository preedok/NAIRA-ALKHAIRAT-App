# Bintang Global Group - Frontend Application

Enterprise B2B Platform for Umroh Travel Management System

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Or if you encounter dependency conflicts
npm install --legacy-peer-deps

# Start development server
npm start
```

The application will open at `http://localhost:3000`

## 🔐 Demo Accounts

Use these credentials to login (Password for all: `password123`):

| Role | Email | Access Level |
|------|-------|--------------|
| **Super Admin** | superadmin@bintangglobal.com | Full system access |
| **Admin Pusat** | adminpusat@bintangglobal.com | Central admin access |
| **Admin Cabang** | admincabang.surabaya@bintangglobal.com | Branch admin access |
| **Role Invoice** | invoice@bintangglobal.com | Invoice management |
| **Role Handling** | handling@bintangglobal.com | Handling operations |
| **Role Visa** | visa@bintangglobal.com | Visa processing |
| **Role Bus** | bus@bintangglobal.com | Bus management |
| **Role Ticket** | ticket@bintangglobal.com | Ticket management |
| **Role Accounting** | accounting@bintangglobal.com | Financial reports |
| **Owner** | owner@example.com | Travel partner access |

## 📁 Project Structure

```
src/
├── components/
│   ├── common/              # Reusable components
│   │   └── ProtectedRoute.tsx
│   ├── layout/              # Layout components
│   ├── dashboard/           # Dashboard-specific components
│   └── auth/                # Authentication components
├── contexts/
│   └── AuthContext.tsx      # Authentication state management
├── layouts/
│   └── DashboardLayout.tsx  # Main dashboard layout
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx    # Login page
│   └── dashboard/
│       └── SuperAdminDashboard.tsx
├── routes/
│   └── index.tsx            # Router configuration
├── services/
│   └── authService.ts       # Authentication service
├── types/
│   └── index.ts             # TypeScript type definitions
├── App.tsx                  # Main App component
└── index.tsx                # Entry point
```

## 🎨 Features Implemented

### ✅ Authentication System
- **Login Page** with Material-UI components
- **Form Validation** with error handling
- **Role-based Authentication**
- **Protected Routes** with authorization
- **Session Management** with localStorage
- **Quick Login** demo accounts

### ✅ Dashboard Layout
- **Responsive Sidebar** navigation
- **Top Navigation Bar** with notifications
- **User Profile Menu**
- **Role-based Menu Items**
- **Mobile-responsive** design
- **Notification System** (UI ready)

### ✅ Super Admin Dashboard
- **Real-time Statistics Cards**
  - Total Revenue
  - Total Orders
  - Active Partners
  - Total Jamaah
- **Recent Orders Table**
- **Branch Performance** metrics
- **Product Statistics** with progress bars
- **Quick Actions** buttons
- **System Status** monitoring

### ✅ Type Safety
- **Full TypeScript** implementation
- **Strict typing** for all entities
- **Interface definitions** for:
  - User & Roles
  - Orders & Invoices
  - Products (Hotels, Visa, Tickets, Bus)
  - Notifications
  - Branches

## 🛠️ Tech Stack

- **React 18.2** - UI Library
- **TypeScript 4.9** - Type safety
- **Material-UI 5** - UI Components
- **React Router DOM 6** - Routing
- **Context API** - State management
- **LocalStorage** - Session persistence

## 🔒 Role-Based Access Control

The system implements comprehensive RBAC:

### Super Admin
- Full access to all features
- User management
- Branch management
- System settings
- All reports

### Admin Pusat
- Manage products (hotels, visa, tickets, bus)
- Manage packages
- View all orders and invoices
- Branch oversight

### Admin Cabang
- Manage branch users
- View branch reports
- Manage owners

### Role-specific Staff
- **Invoice**: Order creation, invoice management
- **Handling**: Hotel allocation, room management
- **Visa**: Visa processing and documents
- **Bus**: Bus allocation and management
- **Ticket**: Ticket booking and management
- **Accounting**: Financial reports, payment tracking

### Owner (Travel Partner)
- View products
- Create orders
- View own orders and invoices
- Upload payment proof

## 📱 Responsive Design

- **Desktop** (1200px+): Full sidebar navigation
- **Tablet** (768px - 1199px): Collapsible sidebar
- **Mobile** (<768px): Drawer navigation

## 🚧 Coming Soon

The following pages are placeholders and will be implemented:

- [ ] Hotels Management
- [ ] Visa Management
- [ ] Tickets Management
- [ ] Bus Management
- [ ] Package Management
- [ ] Orders Management
- [ ] Invoice Management
- [ ] User Management
- [ ] Branch Management
- [ ] Reports & Analytics
- [ ] Settings
- [ ] Profile Management

## 📝 Development Notes

### Mock Data
All data is currently mocked in the services layer:
- `authService.ts` - User authentication
- Dashboard statistics are hardcoded for demo

### Adding New Routes

1. Create page component in `src/pages/`
2. Add route in `src/routes/index.tsx`
3. Add menu item in `src/layouts/DashboardLayout.tsx`
4. Define allowed roles in route configuration

Example:
```typescript
{
  path: 'new-page',
  element: (
    <ProtectedRoute allowedRoles={['super_admin', 'admin_pusat']}>
      <NewPage />
    </ProtectedRoute>
  )
}
```

### Creating Protected Components

```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user, hasRole } = useAuth();

  if (!hasRole(['super_admin', 'admin_pusat'])) {
    return <div>Access Denied</div>;
  }

  return <div>Protected Content</div>;
};
```

## 🔧 Available Scripts

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Eject from create-react-app (not recommended)
npm run eject
```

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📄 License

Copyright © 2024 Bintang Global Group. All rights reserved.

## 👥 Support

For support, email: support@bintangglobal.com

---

**Built with ❤️ for Bintang Global Group**