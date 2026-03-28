package com.example;

import org.testng.annotations.Test;

public class TestNGOrderedTest {

    @Test
    public void createUser() {}

    @Test(dependsOnMethods = "createUser")
    public void verifyUser() {}

    @Test(dependsOnMethods = {"verifyUser", "createUser"})
    public void deleteUser() {}
}
