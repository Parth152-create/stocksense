package com.stocksense.dto;

public class RegisterRequestDTO {
    private String email;
    private String password;
    private String name;

    public String getEmail()    { return email; }
    public String getPassword() { return password; }
    public String getName()     { return name; }

    public void setEmail(String email)       { this.email = email; }
    public void setPassword(String password) { this.password = password; }
    public void setName(String name)         { this.name = name; }
}