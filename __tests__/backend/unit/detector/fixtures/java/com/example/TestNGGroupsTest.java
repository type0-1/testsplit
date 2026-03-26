package com.example;

import org.testng.annotations.Test;

public class TestNGGroupsTest {

    @Test(groups = {"setup"})
    public void startServer() {}

    @Test(groups = {"setup"})
    public void seedDatabase() {}

    @Test(dependsOnGroups = {"setup"})
    public void runSuite() {}
}
