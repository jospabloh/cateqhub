import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full p-8 bg-card rounded-2xl shadow-md shadow-primary/5 border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-gold/15">
            <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-heading font-semibold text-foreground mb-4">Acceso restringido</h1>
          <p className="text-muted-foreground mb-8">
            No estás registrado para usar esta aplicación. Contacta al administrador de tu parroquia para solicitar acceso.
          </p>
          <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground text-left">
            <p>Si crees que esto es un error, puedes:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verificar que iniciaste sesión con la cuenta correcta</li>
              <li>Contactar al administrador para solicitar acceso</li>
              <li>Cerrar sesión y volver a ingresar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
